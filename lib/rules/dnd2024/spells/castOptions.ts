// Opciones del botón Lanzar de la tabla de conjuros (spec de la tabla de conjuros §2.3).
import type { Slots } from "@/lib/rules/dnd2024/derive/spells";
import { PACT_SLOT } from "@/lib/rules/dnd2024/spells/spellOps";
import type { SpellRow } from "@/lib/rules/dnd2024/spells/spellTable";

export type CastOption =
  | { kind: "slot"; level: string; label: string }
  | { kind: "ritual"; label: string };

/**
 * Cómo se puede lanzar: con un espacio libre de su nivel o superior (en orden), con el de pacto si llega y, si es
 * ritual, sin gastar nada (al final). Los trucos y los conjuros con usos limitados no tienen opciones.
 */
export function castOptions(row: SpellRow, slots: Slots, used: Record<string, number>): CastOption[] {
  if (row.level === 0 || row.limited) return [];
  const out: CastOption[] = Object.keys(slots.levels)
    .map(Number)
    .filter((n) => n >= row.level && slots.levels[String(n)] - (used[String(n)] ?? 0) > 0)
    .sort((a, b) => a - b)
    .map((n) => ({ kind: "slot", level: String(n), label: `Nivel ${n}` }));
  const { pact } = slots;
  if (pact && pact.level >= row.level && pact.count - (used[PACT_SLOT] ?? 0) > 0) {
    out.push({ kind: "slot", level: PACT_SLOT, label: `Magia de pacto (nivel ${pact.level})` });
  }
  if (row.ritual) out.push({ kind: "ritual", label: "Lanzar como ritual" });
  return out;
}
