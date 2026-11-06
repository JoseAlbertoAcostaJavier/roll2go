// Cambios de conjuros desde la ficha (spec de conjuros §2.5): preparar y dejar de preparar, copiar al libro del Mago,
// gastar espacios y usos por descanso largo, elegir la alternativa de conjuros de una subclase
// y los conjuros de Dominio de conjuros. Funciones puras: validan la operación del cliente sobre la hoja guardada y
// devuelven la hoja nueva; la ruta relee el personaje y recalcula los bloques antes de aplicarlas.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { Ref, SpellData } from "@/lib/rules/types";
import { innateKey, innateMax, type CasterBlock, type OtherSpell, type Slots, type SpellsSummary } from "../derive/spells";
import { refKey } from "../sheet/equipmentRefs";
import type { Dnd2024SheetV2, Named } from "../sheet/sheet";
import { preparedKey, spellListOf } from "./spellcasting";

export type SpellOp =
  | { op: "prepare" | "unprepare"; class: Ref; ref: Ref }
  | { op: "copy"; ref: Ref }
  | { op: "slot"; level: string; used: number }
  | { op: "setOption"; subclass: Ref; name: string | null }
  | { op: "limited"; key: string; used: number }
  | { op: "setMastery"; level: 1 | 2; ref: Ref | null };

export type SpellOpCtx = {
  /** Bloques de lanzador de la hoja guardada (`derive(...).spells.blocks`). */
  blocks: CasterBlock[];
  slots: Slots;
  /** Conjuros de especie, legado, dotes… (`derive(...).spells.other`): los `innate` de nivel 1+ tienen un uso gratis. */
  other: OtherSpell[];
  /** Bonificador de competencia (`derive(...).proficiencyBonus`): los usos de los conjuros innatos `uses: "pb"`. */
  proficiencyBonus?: number;
  /** Entradas del catálogo de los libros utilizables (el conjuro de la operación y las clases de la hoja). */
  resolve: (ref: Ref) => CatalogEntry | null;
};

export type SpellOpResult = { ok: true; sheet: Dnd2024SheetV2 } | { ok: false; error: string };

export const SLOT_LEVELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
export const PACT_SLOT = "pact";
/** Tiempo de lanzamiento que exige Dominio de conjuros (como lo guarda el importador: `spellTime`). */
export const ACTION_TIME = "1 acción";
// Usos que también se recuperan con un descanso corto (Conjuros distintivos: `signatureKey`)
const SIGNATURE_PREFIX = "signature:";
// Usos gratis de los conjuros de especie, legado y dotes (`innateKey`)
const INNATE_PREFIX = "innate:";
/** Si los usos de esta clave de `limitedUsed` se recuperan también con un descanso corto (Conjuros distintivos). */
export const recoversOnShortRest = (key: string) => key.startsWith(SIGNATURE_PREFIX);

/** Si hay algo que un descanso corto recupere ahora: el personaje tiene Magia de pacto o Conjuros distintivos y
 *  tiene gastado alguno de sus espacios de pacto o de sus usos. */
export function shortRestRestores(spells: Pick<SpellsSummary, "blocks" | "slots" | "used">): boolean {
  const shortLimited = spells.blocks.flatMap((b) => b.limited).filter((l) => recoversOnShortRest(l.key));
  if (!spells.slots.pact && shortLimited.length === 0) return false;
  return (spells.used[PACT_SLOT] ?? 0) > 0 || shortLimited.some((l) => l.used > 0);
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const asRef = (v: unknown): Ref | null =>
  isObj(v) && typeof v.book === "string" && typeof v.key === "string" ? { book: v.book, key: v.key } : null;
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const nameOf = (e: CatalogEntry) => e.nameEs || e.name;
const has = (list: { ref: Ref }[] | Ref[], ref: Ref) =>
  list.some((x) => refKey("ref" in x ? x.ref : x) === refKey(ref));

// Usos gratis de los conjuros de especie, legado y dotes de nivel 1+ (un uso por descanso largo; los trucos, a voluntad)
const innateUses = (ctx: SpellOpCtx): { key: string; spell: Named; max: number }[] =>
  ctx.other.flatMap((o) => {
    const level = (ctx.resolve(o.spell.ref)?.data as SpellData | undefined)?.level ?? 0;
    return o.innate && level > 0 ? [{ key: innateKey(o.spell.ref), spell: o.spell, max: innateMax(o.uses, ctx.proficiencyBonus) }] : [];
  });

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

// Si el conjuro está en la lista de la clase del bloque (o, con Secretos mágicos, en una de sus listas)
function inClassList(block: CasterBlock, data: SpellData, ctx: SpellOpCtx): boolean {
  const lists = block.lists ?? [spellListOf(block.class, ctx.resolve(block.class)?.identifier)];
  return data.classes.some((c) => lists.includes(c));
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
    // Nunca se supera el límite: se comprueba sobre lo guardado (sin los que también están siempre preparados)
    const counted = current.filter((r) => !block.always.some((a) => refKey(a.spell.ref) === refKey(r))).length;
    if (counted >= block.preparedLimit) return fail(preparedFullError(counted, block.preparedLimit));
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

  // Usos gastados de un conjuro por descanso largo (Arcano místico, Conjuros distintivos): solo de los que tiene y
  // entre 0 y su máximo
  if (op.op === "limited") {
    const limited = [...ctx.blocks.flatMap((b) => b.limited), ...innateUses(ctx)].find((l) => l.key === op.key);
    if (!limited) return fail("No tienes ese uso.");
    if (!isInt(op.used) || op.used < 0 || op.used > limited.max)
      return fail(`${limited.spell.name} solo tiene ${limited.max} ${limited.max === 1 ? "uso" : "usos"} por descanso largo.`);
    return { ok: true, sheet: { ...sheet, limitedUsed: { ...(sheet.limitedUsed ?? {}), [limited.key]: op.used } } };
  }

  // Alternativa de conjuros de una subclase (la tierra del Círculo de la Tierra); `name: null` la quita
  if (op.op === "setOption") {
    const sub = asRef(op.subclass);
    const block = sub ? ctx.blocks.find((b) => b.spellOptions && refKey(b.spellOptions.subclass) === refKey(sub)) : undefined;
    const options = block?.spellOptions;
    if (!block || !options) return fail("Esa subclase no tiene conjuros a elegir.");
    const key = preparedKey(options.subclass);
    const rest = Object.fromEntries(Object.entries(sheet.spellOption ?? {}).filter(([k]) => k !== key));
    if (op.name === null) return { ok: true, sheet: { ...sheet, spellOption: rest } };
    if (typeof op.name !== "string" || !options.names.includes(op.name)) return fail("Opción no válida.");
    // Los preparados que pasan a estar siempre preparados con la nueva alternativa dejan de estar preparados
    const granted = new Set((options.spells[op.name] ?? []).map(refKey));
    const classKey = preparedKey(block.class);
    const kept = (prepared[classKey] ?? []).filter((r) => !granted.has(refKey(r)));
    return {
      ok: true,
      sheet: {
        ...sheet, spellOption: { ...rest, [key]: op.name },
        ...(prepared[classKey] ? { prepared: { ...prepared, [classKey]: kept } } : {}),
      },
    };
  }
  // Dominio de conjuros (Mago 18): un conjuro del libro del nivel `level` (1 o 2) que se lance con una acción;
  // `ref: null` lo quita
  if (op.op === "setMastery") {
    const block = ctx.blocks.find((b) => b.mastery);
    if (!block) return fail("No tienes Dominio de conjuros.");
    const level = op.level;
    if (level !== 1 && level !== 2) return fail("Nivel no válido.");
    const rest = Object.fromEntries(Object.entries(sheet.spellMastery ?? {}).filter(([k]) => k !== String(level)));
    if (op.ref === null) return { ok: true, sheet: { ...sheet, spellMastery: rest } };
    const ref = asRef(op.ref);
    const entry = ref && ref.key.startsWith("spell:") ? ctx.resolve(ref) : null;
    if (!entry) return fail("Conjuro no disponible.");
    const data = entry.data as SpellData;
    if (!has(block.spellbook, entry.ref)) return fail(`${nameOf(entry)} no está en tu libro de conjuros.`);
    if (data.level !== level) return fail(`${nameOf(entry)} no es un conjuro de nivel ${level}.`);
    if (data.time !== ACTION_TIME) return fail(`${nameOf(entry)} no se lanza con una acción.`);
    const chosen = { book: entry.ref.book, key: entry.ref.key };
    return { ok: true, sheet: { ...sheet, spellMastery: { ...rest, [level]: chosen } } };
  }
  return fail("Operación no válida.");
}

/**
 * Preparados y espacios gastados que siguen valiendo tras perder un nivel: de cada clase, los que puede preparar (en
 * el libro si es el Mago, de nivel no superior al máximo) hasta su límite, quitando los últimos añadidos; las clases
 * que ya no lanzan pierden los suyos. Los espacios gastados se recortan a los disponibles y los usos por descanso
 * largo de los conjuros que ya no tiene (un arcano del nivel borrado) se quitan. `after`: bloques y
 * espacios de la hoja sin el nivel; `spellLevel`, el nivel de un conjuro (undefined si no está en el catálogo: se
 * conserva).
 */
export function trimSpells(
  sheet: Dnd2024SheetV2,
  after: { blocks: CasterBlock[]; slots: Slots; spellLevel: (ref: Ref) => number | undefined },
): Pick<Dnd2024SheetV2, "prepared" | "slotsUsed" | "limitedUsed"> {
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
  if (!sheet.limitedUsed) return { prepared, slotsUsed };
  // (los usos de especie, legado y dotes no dependen del nivel de clase: se conservan hasta el descanso largo)
  const keys = new Set(after.blocks.flatMap((b) => b.limited.map((l) => l.key)));
  const limitedUsed = Object.fromEntries(
    Object.entries(sheet.limitedUsed).filter(([k]) => keys.has(k) || k.startsWith(INNATE_PREFIX)));
  return { prepared, slotsUsed, limitedUsed };
}
