// Filtros de las listas de conjuros de la ficha (spec de conjuros §4.1): nombre sin tildes, niveles (0 = trucos),
// escuela y etiquetas. Funciones puras.
import { normalizeName } from "@/lib/rules/schemas";
import type { SpellData } from "@/lib/rules/types";

export type SpellFilter = {
  name: string;
  /** Niveles marcados (0 = trucos); vacío = todos. */
  levels: number[];
  /** Letra de la escuela; "" = todas. */
  school: string;
  /** Etiquetas que tiene que tener (todas). */
  tags: string[];
};

export const EMPTY_SPELL_FILTER: SpellFilter = { name: "", levels: [], school: "", tags: [] };

type Filterable = { name: string; nameEs: string | null; data: Pick<SpellData, "level" | "school" | "tags"> };

/** Si el conjuro pasa el filtro. */
export function matchesSpellFilter(spell: Filterable, f: SpellFilter): boolean {
  const q = normalizeName(f.name.trim());
  if (q && !normalizeName(spell.nameEs ?? "").includes(q) && !normalizeName(spell.name).includes(q)) return false;
  if (f.levels.length && !f.levels.includes(spell.data.level)) return false;
  if (f.school && spell.data.school !== f.school) return false;
  return f.tags.every((t) => spell.data.tags.includes(t));
}
