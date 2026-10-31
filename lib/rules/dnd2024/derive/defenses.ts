// Resistencias, inmunidades y vulnerabilidades del personaje (y inmunidades a estados) con la fuente de cada una.
// Función pura: `derive` le pasa especie, linaje, dotes y objetos equipados.
import type { Defenses } from "@/lib/rules/types";

export type DefenseKind = "resist" | "immune" | "vulnerable" | "conditionImmune";
/** `type: null`: «a elegir», un `choose` sin elección hecha. */
export type DefenseRow = { kind: DefenseKind; type: string | null; sources: string[] };

const KINDS: DefenseKind[] = ["resist", "immune", "vulnerable", "conditionImmune"];

/**
 * Filas de defensas de las fuentes dadas. `chosen`: los tipos elegidos para los `choose` de esa fuente (dotes); sin
 * ellos, cada `choose` sale como una fila «a elegir». Un mismo `kind` y `type` de varias fuentes sale una vez, con
 * todas; el orden es el de los tipos (resistencias, inmunidades, vulnerabilidades, estados) y, dentro, el de aparición.
 */
export function defensesOf(sources: { name: string; defenses?: Defenses; chosen?: string[] }[]): DefenseRow[] {
  const rows: DefenseRow[] = [];
  const add = (kind: DefenseKind, type: string | null, source: string) => {
    const row = rows.find((r) => r.kind === kind && r.type === type);
    if (!row) rows.push({ kind, type, sources: [source] });
    else if (!row.sources.includes(source)) row.sources.push(source);
  };
  for (const s of sources) {
    for (const kind of KINDS) {
      for (const entry of s.defenses?.[kind] ?? []) {
        if (typeof entry === "string") add(kind, entry, s.name);
        else if (s.chosen?.length) for (const t of s.chosen) add(kind, t, s.name);
        else add(kind, null, s.name);
      }
    }
  }
  return KINDS.flatMap((k) => rows.filter((r) => r.kind === k));
}
