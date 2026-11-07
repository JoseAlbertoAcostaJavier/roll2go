// Descansos (spec del descanso corto §2–§3): dados de golpe por clase, descanso corto con gasto de dados y descanso
// largo. Funciones puras: validan la operación del cliente sobre la hoja guardada y devuelven la hoja nueva; el
// servicio aporta las tiradas (`ctx.roll`), el modificador de Constitución y los PG máximos calculados.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { ClassData } from "@/lib/rules/types";
import { PACT_SLOT, recoversOnShortRest } from "../spells/spellOps";
import type { FeatureUse } from "../derive/featureUses";
import { refKey } from "./equipmentRefs";
import type { Dnd2024SheetV2 } from "./sheet";
import { summarizeClasses } from "./upgrade";

/** Dados de golpe de una clase: caras, total (nivel en la clase) y gastados. */
export type HitDicePool = { classKey: string; name: string; die: number; total: number; used: number };

export type RestOp = { op: "longRest" } | { op: "shortRest"; spend?: Record<string, number>; healing?: number };

export type RestCtx = {
  pools: HitDicePool[];
  /** Modificador de Constitución. */
  conMod: number;
  /** PG máximos calculados. */
  maxHp: number;
  /** Tirada de un dado de `die` caras (1..die). */
  roll: (die: number) => number;
  /** Usos de los rasgos con contador (con los gastados) y cómo se recuperan. */
  featureUses: FeatureUse[];
};

/** `healed`: PG recuperados de verdad (sin pasar del máximo); `rolls`: las tiradas hechas (vacío si el total se dio a mano). */
export type RestResult =
  | { ok: true; sheet: Dnd2024SheetV2; healed: number; rolls: number[] }
  | { ok: false; error: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Dados de golpe de cada clase del historial (en su orden). Las clases sin datos en el catálogo no aparecen. */
export function hitDicePools(sheet: Dnd2024SheetV2, entries: Map<string, CatalogEntry>): HitDicePool[] {
  const pools: HitDicePool[] = [];
  for (const row of summarizeClasses(sheet.levels)) {
    const classKey = refKey(row.class.ref);
    const entry = entries.get(classKey);
    if (!entry) continue;
    const die = (entry.data as ClassData).hitDie;
    pools.push({
      classKey, name: entry.nameEs || entry.name, die, total: row.level,
      used: Math.min(sheet.hitDiceUsed?.[classKey] ?? 0, row.level),
    });
  }
  return pools;
}

/** Lo que pueden curar estos dados (cada uno cura al menos 1): para validar el total manual y enseñar el rango. */
export function healingRange(dice: number[], conMod: number): { min: number; max: number } {
  return {
    min: dice.length * Math.max(1, 1 + conMod),
    max: dice.reduce((sum, die) => sum + Math.max(1, die + conMod), 0),
  };
}

/** Aplica un descanso largo o corto (spec §3) sobre la hoja guardada. */
export function applyRest(sheet: Dnd2024SheetV2, op: unknown, ctx: RestCtx): RestResult {
  if (!isObj(op)) return fail("Petición no válida.");

  // Descanso largo: espacios, usos, dados de golpe y PG (`current: null` = al máximo) sin temporales; el agotamiento
  // baja 1 (la inspiración y los estados no cambian)
  if (op.op === "longRest") {
    const next: Dnd2024SheetV2 = {
      ...sheet, slotsUsed: {}, limitedUsed: {}, hitDiceUsed: {}, hp: { ...sheet.hp, current: null, temp: op.keepTemp === true ? sheet.hp.temp : 0 },
    };
    if (sheet.featureUses) next.featureUses = {};
    if (sheet.exhaustion !== undefined) next.exhaustion = Math.max(0, sheet.exhaustion - 1);
    return { ok: true, healed: 0, rolls: [], sheet: next };
  }
  if (op.op !== "shortRest") return fail("Operación no válida.");

  // Dados que se gastan, en el orden de las clases
  const spend = op.spend ?? {};
  if (!isObj(spend)) return fail("Petición no válida.");
  for (const [key, n] of Object.entries(spend)) {
    const pool = ctx.pools.find((p) => p.classKey === key);
    if (!pool || !isInt(n) || n < 0 || n > pool.total - pool.used)
      return fail(`No te quedan tantos dados de golpe de ${pool?.name ?? key}.`);
  }
  const spent = ctx.pools.map((p) => ({ pool: p, n: (spend[p.classKey] as number | undefined) ?? 0 })).filter((s) => s.n > 0);
  const dice = spent.flatMap(({ pool, n }) => Array<number>(n).fill(pool.die));

  // Curación: la tirada de Roll2Go o el total de una tirada física
  let amount = 0;
  let rolls: number[] = [];
  if (op.healing !== undefined) {
    if (dice.length === 0) return fail("Elige qué dados de golpe gastas.");
    const { min, max } = healingRange(dice, ctx.conMod);
    if (!isInt(op.healing) || op.healing < min || op.healing > max)
      return fail(`Con esos dados recuperas entre ${min} y ${max} puntos de golpe.`);
    amount = op.healing;
  } else {
    rolls = dice.map((die) => ctx.roll(die));
    amount = rolls.reduce((sum, r) => sum + Math.max(1, r + ctx.conMod), 0);
  }

  // Recupera los espacios de Magia de pacto y los usos de los Conjuros distintivos
  const slotsUsed = Object.fromEntries(Object.entries(sheet.slotsUsed ?? {}).filter(([k]) => k !== PACT_SLOT));
  const next: Dnd2024SheetV2 = { ...sheet, slotsUsed };
  if (sheet.limitedUsed)
    next.limitedUsed = Object.fromEntries(Object.entries(sheet.limitedUsed).filter(([k]) => !recoversOnShortRest(k)));

  // Usos de los rasgos: todos o los que diga cada uno; solo se guardan los gastados
  if (sheet.featureUses) {
    const left = { ...sheet.featureUses };
    for (const u of ctx.featureUses) {
      if (u.used === 0 || u.recovery.short === "none") continue;
      const used = u.recovery.short === "all" ? 0 : Math.max(0, u.used - u.recovery.short);
      if (used > 0) left[u.key] = used;
      else delete left[u.key];
    }
    next.featureUses = left;
  }

  // Opción del diálogo: quitar los PG temporales al terminar
  if (op.clearTemp === true) next.hp = { ...sheet.hp, temp: 0 };

  let healed = 0;
  if (dice.length > 0) {
    const before = sheet.hp.current ?? ctx.maxHp;
    const current = Math.min(ctx.maxHp, before + amount);
    healed = Math.max(0, current - before);
    next.hp = { ...next.hp, current: current >= ctx.maxHp ? null : current };
    next.hitDiceUsed = { ...sheet.hitDiceUsed };
    for (const { pool, n } of spent) next.hitDiceUsed[pool.classKey] = (sheet.hitDiceUsed?.[pool.classKey] ?? 0) + n;
  }
  return { ok: true, sheet: next, healed, rolls };
}
