// Cambios de conjuros desde la ficha (spec de conjuros §2.5): preparar y dejar de preparar, copiar al libro del Mago,
// gastar espacios y descanso largo. Funciones puras: validan la operación del cliente sobre la hoja guardada y
// devuelven la hoja nueva; la ruta relee el personaje y recalcula los bloques antes de aplicarlas.
import type { CatalogEntry } from "@/lib/rules/catalog";
import type { Ref, SpellData } from "@/lib/rules/types";
import type { CasterBlock, Slots } from "./derive/spells";
import { refKey } from "./equipmentRefs";
import type { Dnd2024SheetV2, Named } from "./sheet";
import { preparedKey, spellListOf } from "./spellcasting";

export type SpellOp =
  | { op: "prepare" | "unprepare"; class: Ref; ref: Ref }
  | { op: "copy"; ref: Ref }
  | { op: "slot"; level: string; used: number }
  | { op: "longRest" };

export type SpellOpCtx = {
  /** Bloques de lanzador de la hoja guardada (`derive(...).spells.blocks`). */
  blocks: CasterBlock[];
  slots: Slots;
  /** Entradas del catálogo de los libros utilizables (el conjuro de la operación y las clases de la hoja). */
  resolve: (ref: Ref) => CatalogEntry | null;
};

export type SpellOpResult = { ok: true; sheet: Dnd2024SheetV2 } | { ok: false; error: string };

export const SLOT_LEVELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
export const PACT_SLOT = "pact";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const asRef = (v: unknown): Ref | null =>
  isObj(v) && typeof v.book === "string" && typeof v.key === "string" ? { book: v.book, key: v.key } : null;
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const nameOf = (e: CatalogEntry) => e.nameEs || e.name;
const has = (list: { ref: Ref }[] | Ref[], ref: Ref) =>
  list.some((x) => refKey("ref" in x ? x.ref : x) === refKey(ref));

/** Error al preparar con el límite lleno (también lo muestra la ficha). */
export const preparedFullError = (count: number, limit: number) => `Ya tienes ${count} de ${limit} conjuros preparados.`;

// Conjuro de la operación: del catálogo (libros utilizables), de nivel 1 o más y que la clase pueda preparar
function spellFor(
  block: CasterBlock, raw: unknown, ctx: SpellOpCtx, cantripError = "Los trucos no se preparan.",
): { ok: true; entry: CatalogEntry; data: SpellData } | { ok: false; error: string } {
  const ref = asRef(raw);
  const entry = ref && ref.key.startsWith("spell:") ? ctx.resolve(ref) : null;
  if (!entry) return fail("Conjuro no disponible.");
  const data = entry.data as SpellData;
  if (data.level < 1) return fail(cantripError);
  if (data.level > block.maxSpellLevel)
    return fail(`${nameOf(entry)} es de nivel ${data.level}; ${block.name} puede preparar hasta el nivel ${block.maxSpellLevel}.`);
  return { ok: true, entry, data };
}

// Si el conjuro está en la lista de la clase del bloque
function inClassList(block: CasterBlock, data: SpellData, ctx: SpellOpCtx): boolean {
  const list = spellListOf(block.class, ctx.resolve(block.class)?.identifier);
  return data.classes.includes(list);
}

/** Valida `op` (spec §2.5) sobre la hoja guardada y devuelve la hoja con el cambio. */
export function applySpellOp(sheet: Dnd2024SheetV2, op: unknown, ctx: SpellOpCtx): SpellOpResult {
  if (!isObj(op)) return fail("Petición no válida.");
  const prepared = sheet.prepared ?? {};

  if (op.op === "prepare" || op.op === "unprepare") {
    const cls = asRef(op.class);
    const block = cls ? ctx.blocks.find((b) => refKey(b.class) === refKey(cls)) : undefined;
    if (!block) return fail("Esa clase no lanza conjuros.");
    if (block.mode === "levelUp") return fail(`Los conjuros de ${block.name} se cambian al subir de nivel.`);
    const key = preparedKey(block.class);
    const current = prepared[key] ?? [];

    if (op.op === "unprepare") {
      const ref = asRef(op.ref);
      if (!ref) return fail("Conjuro no disponible.");
      // Si ya no estaba (otra petición se adelantó), no cambia nada
      return { ok: true, sheet: { ...sheet, prepared: { ...prepared, [key]: current.filter((r) => refKey(r) !== refKey(ref)) } } };
    }

    const spell = spellFor(block, op.ref, ctx);
    if (!spell.ok) return spell;
    const { entry, data } = spell;
    if (has(current, entry.ref)) return { ok: true, sheet };
    if (block.always.some((a) => refKey(a.spell.ref) === refKey(entry.ref)))
      return fail(`${nameOf(entry)} ya está siempre preparado.`);
    if (block.mode === "spellbook" ? !has(block.spellbook, entry.ref) : !inClassList(block, data, ctx))
      return fail(block.mode === "spellbook"
        ? `${nameOf(entry)} no está en tu libro de conjuros.`
        : `${nameOf(entry)} no está en la lista de ${block.name}.`);
    // Nunca se supera el límite: se comprueba sobre lo guardado
    if (current.length >= block.preparedLimit) return fail(preparedFullError(current.length, block.preparedLimit));
    const ref = { book: entry.ref.book, key: entry.ref.key };
    return { ok: true, sheet: { ...sheet, prepared: { ...prepared, [key]: [...current, ref] } } };
  }

  if (op.op === "copy") {
    const block = ctx.blocks.find((b) => b.mode === "spellbook");
    if (!block) return fail("Solo se copian conjuros a un libro de conjuros.");
    const spell = spellFor(block, op.ref, ctx, "Los trucos no se copian al libro.");
    if (!spell.ok) return spell;
    const { entry, data } = spell;
    if (!inClassList(block, data, ctx)) return fail(`${nameOf(entry)} no está en la lista de ${block.name}.`);
    if (has(block.spellbook, entry.ref)) return fail(`${nameOf(entry)} ya está en tu libro de conjuros.`);
    const copied: Named = { ref: { book: entry.ref.book, key: entry.ref.key }, name: nameOf(entry) };
    return { ok: true, sheet: { ...sheet, spellbookExtra: [...(sheet.spellbookExtra ?? []), copied] } };
  }

  if (op.op === "slot") {
    const level = op.level;
    const isPact = level === PACT_SLOT;
    if (typeof level !== "string" || (!isPact && !SLOT_LEVELS.includes(level))) return fail("Nivel de espacio no válido.");
    const available = isPact ? (ctx.slots.pact?.count ?? 0) : (ctx.slots.levels[level] ?? 0);
    if (!isInt(op.used) || op.used < 0 || op.used > available) {
      if (available === 0) return fail(isPact ? "No tienes espacios de Magia de pacto." : `No tienes espacios de nivel ${level}.`);
      return fail(isPact
        ? `Solo tienes ${available} espacios de Magia de pacto.`
        : `Solo tienes ${available} espacios de nivel ${level}.`);
    }
    return { ok: true, sheet: { ...sheet, slotsUsed: { ...(sheet.slotsUsed ?? {}), [level]: op.used } } };
  }

  if (op.op === "longRest") return { ok: true, sheet: { ...sheet, slotsUsed: {} } };
  return fail("Operación no válida.");
}

/**
 * Preparados y espacios gastados que siguen valiendo tras perder un nivel: de cada clase, los que puede preparar (en
 * el libro si es el Mago, de nivel no superior al máximo) hasta su límite, quitando los últimos añadidos; las clases
 * que ya no lanzan pierden los suyos. Los espacios gastados se recortan a los disponibles. `after`: bloques y
 * espacios de la hoja sin el nivel; `spellLevel`, el nivel de un conjuro (undefined si no está en el catálogo: se
 * conserva).
 */
export function trimSpells(
  sheet: Dnd2024SheetV2,
  after: { blocks: CasterBlock[]; slots: Slots; spellLevel: (ref: Ref) => number | undefined },
): Pick<Dnd2024SheetV2, "prepared" | "slotsUsed"> {
  const prepared: Record<string, Ref[]> = {};
  for (const [key, refs] of Object.entries(sheet.prepared ?? {})) {
    const block = after.blocks.find((b) => preparedKey(b.class) === key);
    if (!block || block.mode === "levelUp") continue;
    const fits = refs.filter((r) => (after.spellLevel(r) ?? 0) <= block.maxSpellLevel
      && (block.mode !== "spellbook" || has(block.spellbook, r)));
    prepared[key] = fits.slice(0, block.preparedLimit);
  }
  const slotsUsed: Record<string, number> = {};
  for (const [level, used] of Object.entries(sheet.slotsUsed ?? {})) {
    const available = level === PACT_SLOT ? (after.slots.pact?.count ?? 0) : (after.slots.levels[level] ?? 0);
    if (Math.min(used, available) > 0) slotsUsed[level] = Math.min(used, available);
  }
  return { prepared, slotsUsed };
}
