// Acceso a un personaje de D&D 2024 desde las rutas de la ficha. Ver: el dueño o un miembro de su campaña (si está
// pendiente de aprobación, solo el DM); escribir: solo el dueño. Cualquier otro caso devuelve null (las rutas
// responden 404 sin revelar que existe).
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Campaign } from "@/lib/Campaign";
import { Character } from "@/lib/Character";
import { NotFoundError, getEntries, getEntry, usableBooks } from "@/lib/rules/catalog";
import type { AnySheet, Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet";
import { loadSheetEntries } from "@/lib/rules/dnd2024/sheetEntries";
import { loadUpgradeEntries, missingForUpgrade, upgradeSheet } from "@/lib/rules/dnd2024/upgrade";

const newId = () => new mongoose.Types.ObjectId().toHexString();

/** Respuesta de las rutas que escriben en la hoja cuando sigue en v1 (no se pudo convertir) o cambió de versión. */
export const OUTDATED_SHEET_ERROR =
  "Este personaje es de una versión anterior y no se puede editar: falta su clase o su trasfondo en el catálogo.";

/**
 * Personaje al que `userId` puede acceder, con su hoja en v2, los libros que puede usar y las entradas del catálogo
 * de la hoja. null = 404. Para leer, una v1 se convierte en memoria; para escribir, se convierte y se guarda antes
 * (como `npm run migrate:levels`), así los ids de las líneas del inventario son estables. Si no se puede convertir,
 * `outdated` es true y las rutas no deben escribir en la hoja.
 */
export async function loadCharacterFor(userId: string, id: string, mode: "read" | "write") {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const character = await Character.findById(id).lean();
  if (!character || character.systemId !== "dnd-2024") return null;

  const isOwner = String(character.owner) === userId;
  if (!isOwner) {
    if (mode === "write" || !character.campaign) return null;
    // Una solicitud pendiente solo la ve el DM, además del dueño
    const pending = character.campaignStatus === "pending";
    const allowed = await Campaign.exists(
      pending ? { _id: character.campaign, owner: userId } : { _id: character.campaign, members: userId },
    );
    if (!allowed) return null;
  }

  let stored = character.sheet as AnySheet | undefined;
  if (stored?.version !== 1 && stored?.version !== 2) return null;

  if (mode === "write" && stored.version === 1) {
    // Sin filtrar por libros, como la migración: son las elecciones que ya hizo el personaje
    const upgradeEntries = await loadUpgradeEntries(stored, getEntry);
    if (missingForUpgrade(stored, upgradeEntries).length === 0) {
      const upgraded = upgradeSheet(stored, upgradeEntries, newId);
      await Character.updateOne({ _id: character._id, "sheet.version": 1 }, { $set: { sheet: upgraded } });
      // Se sigue con lo guardado (la nuestra o la de otra petición que se adelantó)
      const fresh = await Character.findById(character._id).select("sheet").lean();
      if (!fresh) return null;
      stored = fresh.sheet as AnySheet;
    }
  }

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

  const entries = await loadSheetEntries(stored, books, getEntries);
  const sheet: Dnd2024SheetV2 = upgradeSheet(stored, entries, newId);
  return { character, sheet, books, entries, outdated: stored.version === 1 };
}
