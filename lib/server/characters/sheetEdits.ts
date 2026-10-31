import "server-only";
// Cambios en la hoja desde la ficha: PG, inventario, maestrías con armas y conjuros. Solo el dueño (loadCharacterFor
// en modo "write"). Cada uno escribe solo sus campos, y solo si la hoja sigue en v2, para no pisar otros cambios
// hechos a la vez.
import { Character } from "@/lib/models/Character";
import { OUTDATED_SHEET_ERROR } from "@/lib/server/characters/characterAccess";
import { loadForWrite } from "@/lib/server/characters/writeAccess";
import { getEntries, resolveRef, type CatalogEntry } from "@/lib/server/catalog/catalog";
import { newId } from "@/lib/server/ids";
import { fail, type Result } from "@/lib/server/result";
import { unchangedFilter } from "@/lib/utils/unchangedFilter";
import { derive } from "@/lib/rules/dnd2024/derive";
import { weaponProficient } from "@/lib/rules/dnd2024/derive/attacks";
import { applyHp, applyInventoryOp } from "@/lib/rules/dnd2024/sheet/edits";
import { bareName, isRef, refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { LEVEL_CHANGED } from "@/lib/rules/dnd2024/levels/levelOps";
import { masteryCount, masteryMeleeOnly, validateMasteries } from "@/lib/rules/dnd2024/levels/masteries";
import { applySpellOp } from "@/lib/rules/dnd2024/spells/spellOps";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import type { ItemData, Ref } from "@/lib/rules/types";

type Derived = ReturnType<typeof derive>;

const levelChanged = () => fail(409, LEVEL_CHANGED);

// PG actuales y temporales { current?, temp? }. Devuelve los tres valores.
export async function saveHp(userId: string, id: string, body: unknown): Promise<Result<{ hp: Derived["hp"] }>> {
  const { found, failure } = await loadForWrite(userId, id);
  if (failure) return failure;

  const max = derive(found.sheet, found.entries).hp.max;
  const result = applyHp(found.sheet, body, max);
  if (!result.ok) return fail(400, result.error);

  const res = await Character.updateOne({ _id: id, "sheet.version": 2 }, { $set: { "sheet.hp": result.sheet.hp } });
  if (res.matchedCount === 0) return fail(409, OUTDATED_SHEET_ERROR);
  return { ok: true, hp: derive(result.sheet, found.entries).hp };
}

// Una operación de inventario: add, update, remove, coins u other. Devuelve el inventario completo.
export async function saveInventory(
  userId: string,
  id: string,
  body: unknown,
): Promise<Result<{ inventory: Dnd2024SheetV2["inventory"] }>> {
  const { found, failure } = await loadForWrite(userId, id);
  if (failure) return failure;

  // Objetos que puede ver la operación: los del inventario (ya cargados con la hoja) y, al añadir, el pedido (si es
  // de un libro usable y es un objeto)
  const isItem = (e: CatalogEntry | null | undefined): e is CatalogEntry => !!e && e.ref.key.startsWith("item:");
  const items = new Map([...found.entries].filter(([, e]) => isItem(e)));
  const added = (body as { ref?: { book?: unknown; key?: unknown } } | null)?.ref;
  if (added && typeof added.book === "string" && typeof added.key === "string") {
    const r: Ref = { book: added.book, key: added.key };
    if (!items.has(refKey(r))) {
      const entry = await resolveRef(r, found.books);
      if (isItem(entry)) items.set(refKey(r), entry);
    }
  }

  const result = applyInventoryOp(found.sheet, body, (r) => items.get(refKey(r)) ?? null, newId);
  if (!result.ok) return fail(400, result.error);

  const res = await Character.updateOne(
    { _id: id, "sheet.version": 2 },
    { $set: { "sheet.inventory": result.sheet.inventory } },
  );
  if (res.matchedCount === 0) return fail(409, OUTDATED_SHEET_ERROR);
  return { ok: true, inventory: result.sheet.inventory };
}

const MAX_MASTERY_REFS = 50;

/* Armas con maestría { masteries: Ref[] }: tantas como da la progresión de sus clases; armas sencillas o marciales con
   maestría y con competencia (del Bárbaro, solo cuerpo a cuerpo). */
export async function saveMasteries(
  userId: string,
  id: string,
  body: unknown,
): Promise<Result<{ weaponMasteries: Ref[] }>> {
  const raw = typeof body === "object" && body !== null ? (body as { masteries?: unknown }).masteries : undefined;
  if (!Array.isArray(raw) || raw.length > MAX_MASTERY_REFS || !raw.every(isRef)) return fail(400, "Maestrías no válidas.");
  const masteries = raw.map((r) => ({ book: r.book, key: r.key }));

  const { found, failure } = await loadForWrite(userId, id);
  if (failure) return failure;

  // Las armas, solo de los libros del personaje
  const entries = new Map(found.entries);
  const wanted = masteries.filter((r) => found.books.includes(r.book) && r.key.startsWith("item:"));
  for (const e of await getEntries(wanted)) entries.set(refKey(e.ref), e);

  const weapons = derive(found.sheet, found.entries).weapons;
  const result = validateMasteries(masteries, {
    allowed: masteryCount(found.sheet, entries),
    entries,
    meleeOnly: masteryMeleeOnly(found.sheet, entries),
    proficientWith: (item) => weaponProficient(item.data as ItemData, [item.name, bareName(item.ref.key)], weapons),
  });
  if (!result.ok) return fail(400, result.error);

  // Solo si sigue en el mismo nivel, porque el número permitido depende de él
  const res = await Character.updateOne(
    { _id: id, "sheet.version": 2, "sheet.levels": { $size: found.sheet.levels.length } },
    { $set: { "sheet.weaponMasteries": masteries } },
  );
  if (res.matchedCount === 0) return levelChanged();
  return { ok: true, weaponMasteries: masteries };
}

// Si otra petición cambió el mismo campo entretanto, se vuelve a leer y a comprobar (como mucho estas veces)
const MAX_ATTEMPTS = 3;
const CHANGED_ERROR = "Los conjuros del personaje han cambiado; recarga la página.";

// Campos de la hoja que cambia cada operación (la tierra también quita de los preparados los que pasa a dar; el
// descanso largo recupera espacios, usos y puntos de golpe; el corto, los de pacto y los de los Conjuros distintivos)
type Field = keyof Pick<
  Dnd2024SheetV2, "prepared" | "spellbookExtra" | "slotsUsed" | "spellOption" | "limitedUsed" | "spellMastery" | "hp"
>;
const FIELDS: Record<string, Field[]> = {
  prepare: ["prepared"], unprepare: ["prepared"], copy: ["spellbookExtra"], slot: ["slotsUsed"],
  longRest: ["slotsUsed", "limitedUsed", "hp"], shortRest: ["slotsUsed", "limitedUsed"], setOption: ["spellOption", "prepared"],
  limited: ["limitedUsed"], setMastery: ["spellMastery"],
};

/* Una operación de conjuros (spec de conjuros §2.5). Se comprueba sobre lo guardado y solo se escribe si ese campo
   sigue igual, así nunca se supera el límite con peticiones a la vez. Devuelve los conjuros recalculados. */
export async function applySpellOperation(
  userId: string,
  id: string,
  body: unknown,
): Promise<Result<{ spells: Derived["spells"] }>> {
  const op = typeof body === "object" && body !== null ? (body as { op?: unknown; ref?: unknown }) : {};
  const fields = typeof op.op === "string" && Object.hasOwn(FIELDS, op.op) ? FIELDS[op.op] : null;
  if (!fields) return fail(400, "Operación no válida.");

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { found, failure } = await loadForWrite(userId, id);
    if (failure) return failure;

    // El conjuro de la operación, solo de los libros del personaje
    const entries = new Map(found.entries);
    if (isRef(op.ref) && found.books.includes(op.ref.book) && op.ref.key.startsWith("spell:")) {
      for (const e of await getEntries([{ book: op.ref.book, key: op.ref.key }])) entries.set(refKey(e.ref), e);
    }
    const { blocks, slots } = derive(found.sheet, entries).spells;
    const resolve = (r: Ref) => (found.books.includes(r.book) ? (entries.get(refKey(r)) ?? null) : null);
    const result = applySpellOp(found.sheet, body, { blocks, slots, resolve });
    if (!result.ok) return fail(400, result.error);

    // Solo los campos que cambian, si siguen como se leyeron y en el mismo nivel (los límites dependen de él)
    const stored = found.character.sheet as Record<string, unknown> | undefined;
    const res = await Character.updateOne(
      {
        _id: id, "sheet.version": 2, "sheet.levels": { $size: found.sheet.levels.length },
        ...Object.fromEntries(fields.map((f) => [`sheet.${f}`, unchangedFilter(stored?.[f])])),
      },
      { $set: Object.fromEntries(fields.filter((f) => result.sheet[f] !== undefined).map((f) => [`sheet.${f}`, result.sheet[f]])) },
    );
    if (res.matchedCount === 1) return { ok: true, spells: derive(result.sheet, entries).spells };
  }
  return fail(409, CHANGED_ERROR);
}
