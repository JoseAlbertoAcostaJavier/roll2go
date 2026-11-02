// Opciones del botón Lanzar de la tabla de conjuros (spec de la tabla de conjuros §2.3).
import type { Slots } from "@/lib/rules/dnd2024/derive/spells";
import { PACT_SLOT } from "@/lib/rules/dnd2024/spells/spellOps";
import type { SpellRow } from "@/lib/rules/dnd2024/spells/spellTable";

export type CastOption =
  | { kind: "slot"; level: string; label: string }
  | { kind: "free"; key: string; label: string }
  | { kind: "ritual"; label: string };

// El Arcano místico solo se lanza con su uso: no admite espacios
const ARCANUM_PREFIX = "arcanum:";

/**
 * Cómo se puede lanzar: primero con su uso gratis si le queda (Conjuros distintivos, de especie, legado y dotes,
 * Arcano místico), después con un espacio libre de su nivel o superior (en orden), con el de pacto si llega y, si es
 * ritual, sin gastar nada (al final). Los trucos no tienen opciones.
 */
export function castOptions(row: SpellRow, slots: Slots, used: Record<string, number>): CastOption[] {
  if (row.level === 0) return [];
  const { limited } = row;
  const free: CastOption[] = limited && limited.used < limited.max
    ? [{ kind: "free", key: limited.key, label: `Sin espacio (${limited.max - limited.used}/${limited.max})` }]
    : [];
  if (limited?.key.startsWith(ARCANUM_PREFIX)) return free;
  const out: CastOption[] = [...free, ...Object.keys(slots.levels)
    .map(Number)
    .filter((n) => n >= row.level && slots.levels[String(n)] - (used[String(n)] ?? 0) > 0)
    .sort((a, b) => a - b)
    .map((n): CastOption => ({ kind: "slot", level: String(n), label: `Nivel ${n}` }))];
  const { pact } = slots;
  if (pact && pact.level >= row.level && pact.count - (used[PACT_SLOT] ?? 0) > 0) {
    out.push({ kind: "slot", level: PACT_SLOT, label: `Magia de pacto (nivel ${pact.level})` });
  }
  if (row.ritual) out.push({ kind: "ritual", label: "Lanzar como ritual" });
  return out;
}
