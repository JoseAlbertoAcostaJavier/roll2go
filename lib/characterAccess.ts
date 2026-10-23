// Acceso a un personaje de D&D 2024 desde las rutas de la ficha. Ver: el dueño o un miembro de su campaña; escribir:
// solo el dueño. Cualquier otro caso devuelve null (las rutas responden 404 sin revelar que existe).
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Campaign } from "@/lib/Campaign";
import { Character } from "@/lib/Character";
import { NotFoundError, getEntry, usableBooks, type CatalogEntry } from "@/lib/rules/catalog";
import { equipmentRefs, refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import type { AnySheet, Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet";
import { upgradeSheet } from "@/lib/rules/dnd2024/upgrade";
import type { BackgroundData, ClassData, Ref } from "@/lib/rules/types";

const newId = () => new mongoose.Types.ObjectId().toHexString();

/** Entradas del catálogo que necesita la hoja (especie, clase, trasfondo, equipo…), solo de los libros dados. */
export async function loadSheetEntries(sheet: AnySheet, books: string[]): Promise<Map<string, CatalogEntry>> {
  const entries = new Map<string, CatalogEntry>();
  const tried = new Set<string>();
  const load = async (refs: Ref[]) => {
    const pending = refs.filter((r) => !tried.has(refKey(r)));
    pending.forEach((r) => tried.add(refKey(r)));
    const found = await Promise.all(pending.map((r) => (books.includes(r.book) ? getEntry(r) : null)));
    found.forEach((e, i) => e && entries.set(refKey(pending[i]), e));
    return pending.length;
  };

  const classes =
    sheet.version === 2
      ? sheet.classesSummary.map((c) => ({ ref: c.class.ref, subclass: c.subclass }))
      : sheet.classes.map((c) => ({ ref: c.ref, subclass: c.subclass }));
  const picks =
    sheet.version === 2
      ? sheet.levels.flatMap((l) =>
          l.choices.flatMap((c) =>
            c.type === "feat" ? c.value.map((f) => f.ref) : c.type === "asi" && "feat" in c.value ? [c.value.feat.ref] : [],
          ),
        )
      : [];
  const inventory = sheet.version === 2 ? sheet.inventory.items.flatMap((i) => (i.ref ? [i.ref] : [])) : [];
  await load([
    sheet.species.ref,
    ...(sheet.lineage ? [sheet.lineage.ref] : []),
    sheet.background.ref,
    ...classes.flatMap((c) => [c.ref, ...(c.subclass ? [c.subclass.ref] : [])]),
    ...picks,
    ...inventory,
  ]);
  const bg = entries.get(refKey(sheet.background.ref))?.data as BackgroundData | undefined;
  if (bg?.feat) await load([bg.feat]);

  // Una hoja v1 necesita el equipo inicial elegido (y el contenido de los paquetes) para convertirla en v2
  if (sheet.version === 1) {
    const first = sheet.classes[0];
    const klass = first ? (entries.get(refKey(first.ref))?.data as ClassData | undefined) : undefined;
    const options = [klass?.equipment?.[first?.equipment ?? ""] ?? [], bg?.equipment?.[sheet.background.equipment] ?? []];
    for (let i = 0; i < 4; i++) if ((await load(equipmentRefs(options, (k) => entries.get(k)))) === 0) break;
  }
  return entries;
}

/**
 * Personaje al que `userId` puede acceder, con su hoja en v2 (una v1 se convierte en memoria; quien escribe guarda
 * el resultado), los libros que puede usar y las entradas del catálogo de la hoja. null = 404.
 */
export async function loadCharacterFor(userId: string, id: string, mode: "read" | "write") {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const character = await Character.findById(id).lean();
  if (!character || character.systemId !== "dnd-2024") return null;

  const isOwner = String(character.owner) === userId;
  if (!isOwner) {
    if (mode === "write" || !character.campaign) return null;
    const member = await Campaign.exists({ _id: character.campaign, members: userId });
    if (!member) return null;
  }

  const stored = character.sheet as AnySheet | undefined;
  if (stored?.version !== 1 && stored?.version !== 2) return null;

  // Libros del personaje: su filtro propio o, si no tiene, todos los que le corresponden por sistema y campaña
  const owner = String(character.owner);
  const base = { userId: owner, systemId: character.systemId as string };
  const chosenBooks = ((character.books ?? []) as string[]).length ? (character.books as string[]) : undefined;
  let books: string[];
  try {
    books = await usableBooks({ ...base, campaignId: character.campaign ? String(character.campaign) : undefined, chosenBooks });
  } catch (e) {
    if (!(e instanceof NotFoundError)) throw e;
    // El dueño ya no es miembro de la campaña: se usan los libros que ve por sistema
    books = await usableBooks({ ...base, chosenBooks });
  }

  const entries = await loadSheetEntries(stored, books);
  const sheet: Dnd2024SheetV2 = upgradeSheet(stored, entries, newId);
  return { character, sheet, books, entries };
}
