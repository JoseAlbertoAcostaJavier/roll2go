// Inspiración heroica, estados y agotamiento de la ficha (spec de la ficha visual §2). Funciones puras: validan la
// petición del cliente sobre la hoja guardada y devuelven la hoja nueva.
import { CONDITION_NAMES } from "./labels";
import type { Dnd2024SheetV2 } from "./sheet";

export type StatusOp =
  | { op: "inspiration"; value: boolean }
  | { op: "condition"; key: string; active: boolean }
  | { op: "exhaustion"; level: number };

export type StatusResult = { ok: true; sheet: Dnd2024SheetV2 } | { ok: false; error: string };

/** Los 14 estados de 2024 que se marcan en la ficha, en el orden de `CONDITION_NAMES` (el agotamiento tiene niveles aparte y la enfermedad no es un estado). */
export const CONDITION_KEYS: string[] = Object.keys(CONDITION_NAMES).filter((k) => k !== "exhaustion" && k !== "disease");

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Estado de la hoja con valores por defecto para las guardadas antes. */
export function statusOf(sheet: Dnd2024SheetV2): { heroicInspiration: boolean; conditions: string[]; exhaustion: number } {
  return { heroicInspiration: sheet.heroicInspiration ?? false, conditions: sheet.conditions ?? [], exhaustion: sheet.exhaustion ?? 0 };
}

/** Aplica una operación de estado; añadir uno que ya está o quitar uno que no está no cambia nada. */
export function applyStatus(sheet: Dnd2024SheetV2, op: unknown): StatusResult {
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

  return fail("Petición no válida.");
}
