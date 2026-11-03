// Inspiración heroica, estados y agotamiento de la ficha (spec de la ficha visual §2). Funciones puras: validan la
// petición del cliente sobre la hoja guardada y devuelven la hoja nueva.
import { CONDITION_NAMES } from "./labels";
import type { Dnd2024SheetV2 } from "./sheet";

export type StatusOp =
  | { op: "inspiration"; value: boolean }
  | { op: "condition"; key: string; active: boolean }
  | { op: "exhaustion"; level: number }
  | { op: "featureUse"; key: string; used: number };

/** Lo que el servicio sabe de los usos de los rasgos: el máximo de uno, o `null` si no tiene contador. */
export type StatusCtx = { useMax: (key: string) => number | null };

export type StatusResult = { ok: true; sheet: Dnd2024SheetV2 } | { ok: false; error: string };

/** Los 14 estados de 2024 que se marcan en la ficha, en el orden de `CONDITION_NAMES` (el agotamiento tiene niveles aparte y la enfermedad no es un estado). */
export const CONDITION_KEYS: string[] = Object.keys(CONDITION_NAMES).filter((k) => k !== "exhaustion" && k !== "disease");

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Estado de la hoja con valores por defecto para las guardadas antes. */
export function statusOf(sheet: Dnd2024SheetV2): {
  heroicInspiration: boolean; conditions: string[]; exhaustion: number; featureUses: Record<string, number>;
} {
  return {
    heroicInspiration: sheet.heroicInspiration ?? false, conditions: sheet.conditions ?? [],
    exhaustion: sheet.exhaustion ?? 0, featureUses: sheet.featureUses ?? {},
  };
}

/** Aplica una operación de estado; añadir uno que ya está o quitar uno que no está no cambia nada. */
export function applyStatus(sheet: Dnd2024SheetV2, op: unknown, ctx?: StatusCtx): StatusResult {
  if (!isObj(op)) return fail("Petición no válida.");

  if (op.op === "inspiration") {
    if (typeof op.value !== "boolean") return fail("Petición no válida.");
    return { ok: true, sheet: { ...sheet, heroicInspiration: op.value } };
  }

  if (op.op === "condition") {
    if (typeof op.key !== "string" || typeof op.active !== "boolean") return fail("Petición no válida.");
    if (!CONDITION_KEYS.includes(op.key)) return fail("Estado desconocido.");
    const current = new Set(sheet.conditions ?? []);
    if (op.active) current.add(op.key);
    else current.delete(op.key);
    return { ok: true, sheet: { ...sheet, conditions: CONDITION_KEYS.filter((k) => current.has(k)) } };
  }

  if (op.op === "exhaustion") {
    const level = op.level;
    if (typeof level !== "number" || !Number.isInteger(level) || level < 0 || level > 6)
      return fail("El agotamiento va de 0 a 6.");
    return { ok: true, sheet: { ...sheet, exhaustion: level } };
  }

  // Usos gastados de un rasgo con contador; con 0 se quita la clave
  if (op.op === "featureUse") {
    if (typeof op.key !== "string") return fail("Petición no válida.");
    const max = ctx?.useMax(op.key) ?? null;
    if (max === null) return fail("Ese rasgo no tiene usos.");
    const used = op.used;
    if (typeof used !== "number" || !Number.isInteger(used) || used < 0 || used > max)
      return fail(`Los usos van de 0 a ${max}.`);
    const featureUses = { ...sheet.featureUses };
    if (used > 0) featureUses[op.key] = used;
    else delete featureUses[op.key];
    return { ok: true, sheet: { ...sheet, featureUses } };
  }

  return fail("Petición no válida.");
}
