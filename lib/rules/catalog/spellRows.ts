// Filas ligeras de las listas de conjuros que se piden bajo demanda (creador y asistente de subir de nivel): sin los
// componentes (el texto del material es largo) ni el libro. Módulo puro, para el servidor y el navegador.
import type { SpellOption } from "@/lib/rules/catalog/types";
import type { PendingChoice } from "@/lib/rules/dnd2024/levels";
import type { Ref } from "@/lib/rules/types";

export type SpellRow = {
  ref: Ref;
  name: string;
  nameEs: string | null;
  level: number;
  school: string;
  ritual: boolean;
  concentration: boolean;
  time: string;
  range: string;
  duration: string;
  classes: string[];
  tags: string[];
  /** Línea de resumen (primer párrafo recortado). */
  summary: string;
};

/** Todas las listas de clase (Pacto del tomo, dotes sin lista: Tocado por los feéricos…). */
export const ALL_LISTS = "*";

export const spellRowOf = (s: SpellOption): SpellRow => ({
  ref: s.ref, name: s.name, nameEs: s.nameEs, level: s.data.level, school: s.data.school, ritual: s.data.ritual,
  concentration: s.data.concentration, time: s.data.time, range: s.data.range, duration: s.data.duration,
  classes: s.data.classes, tags: s.data.tags, summary: s.summary,
});

/** Cabecera de las respuestas de las listas: el navegador las reutiliza 5 minutos (son del usuario: privadas). */
export const SPELL_LIST_CACHE = { "Cache-Control": "private, max-age=300" };

/** Identificador de lista válido en una dirección: de clase (`wizard`, o el identificador de una clase de usuario) o
 * `ALL_LISTS`. Solo se compara con `SpellData.classes`. */
export const validList = (list: string | null): list is string => !!list && list.length <= 80;

/** Si la fila es de la lista (`ALL_LISTS`: de cualquiera). */
export const inSpellList = (classes: string[], list: string) => list === ALL_LISTS || classes.includes(list);

/** Fila → conjuro del listado que usan los componentes (lo que no trae la fila queda vacío y no se muestra). */
export const spellOptionOf = (r: SpellRow): SpellOption => ({
  ref: r.ref, name: r.name, nameEs: r.nameEs, bookName: "", srd52: false, summary: r.summary,
  data: {
    level: r.level, school: r.school, time: r.time, range: r.range, components: "", duration: r.duration,
    concentration: r.concentration, ritual: r.ritual, classes: r.classes, tags: r.tags,
  },
});

/**
 * Listas que necesita una elección de conjuros para ofrecer sus opciones (y mostrar los que ya tiene): la de la clase
 * y las de Secretos mágicos; la del Arcano místico; las de los conjuros de un rasgo (`bonusSpells`); las de una dote
 * (las que deja elegir, las de sus filtros o, si un filtro no pide lista, todas). Las demás elecciones, ninguna.
 */
export function pendingSpellLists(p: PendingChoice): string[] {
  if (p.type === "spells" && p.spells) return [...new Set([p.spells.list, ...(p.spells.lists ?? [])])].filter(Boolean);
  if (p.type === "arcanum" && p.arcanum) return [p.arcanum.list];
  if (p.type === "bonusSpells" && p.bonusSpells) return p.bonusSpells.lists;
  if (p.type === "featSpells" && p.featSpells) {
    const fs = p.featSpells;
    if (fs.lists) return fs.lists;
    const filters = [fs.cantrip, fs.spell].filter((f) => !!f);
    return filters.some((f) => !f.classes?.length) ? [ALL_LISTS] : [...new Set(filters.flatMap((f) => f.classes ?? []))];
  }
  return [];
}
