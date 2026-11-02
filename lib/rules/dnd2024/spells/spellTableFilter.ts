// Búsqueda, filtros, URL y agrupado de la tabla de conjuros (spec de la tabla de conjuros §2.2).
import { normalizeName } from "@/lib/rules/schemas";
import type { SpellRow } from "@/lib/rules/dnd2024/spells/spellTable";

/** Tres estados de un filtro sí/no: cualquiera, sí o no. */
export type Tri = "any" | "yes" | "no";
export type SpellTableFilter = {
  q: string;
  kind: "all" | "cantrips" | "spells";
  /** Niveles 0–9 admitidos; vacío = todos. */
  levels: number[];
  concentration: Tri;
  ritual: Tri;
};
export const EMPTY_SPELL_TABLE_FILTER: SpellTableFilter = {
  q: "", kind: "all", levels: [], concentration: "any", ritual: "any",
};

const tri = (v: Tri, flag: boolean) => v === "any" || (v === "yes") === flag;

/** Texto buscable: nombre en español e inglés, etiquetas (daño, estados, tirada) y tiempo de lanzamiento. */
const haystack = (r: SpellRow) => normalizeName([r.name, r.nameEn, ...r.tags, r.time].join(" "));

export function matchesSpellTable(row: SpellRow, f: SpellTableFilter): boolean {
  const q = normalizeName(f.q).trim();
  if (q && !haystack(row).includes(q)) return false;
  if (f.kind === "cantrips" && row.level !== 0) return false;
  if (f.kind === "spells" && row.level === 0) return false;
  if (f.levels.length && !f.levels.includes(row.level)) return false;
  return tri(f.concentration, row.concentration) && tri(f.ritual, row.ritual);
}

type Query = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const KINDS = { trucos: "cantrips", conjuros: "spells" } as const;
const TRI = { si: "yes", no: "no" } as const;

/** Filtro de `?q=&tipo=&nivel=&conc=&ritual=`; lo desconocido vale lo de por defecto. */
export function parseSpellTableFilter(query: Query): SpellTableFilter {
  const levels = (first(query.nivel) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9]$/.test(s))
    .map(Number);
  const pick = <T,>(map: Record<string, T>, v: string | undefined, def: T): T =>
    v !== undefined && Object.hasOwn(map, v) ? map[v] : def;
  return {
    q: first(query.q)?.trim() ?? "",
    kind: pick<SpellTableFilter["kind"]>(KINDS, first(query.tipo), "all"),
    levels: [...new Set(levels)].sort((a, b) => a - b),
    concentration: pick<Tri>(TRI, first(query.conc), "any"),
    ritual: pick<Tri>(TRI, first(query.ritual), "any"),
  };
}

const FILTER_KEYS = new Set(["tab", "q", "tipo", "nivel", "conc", "ritual", "spell", "saved"]);
const KIND_PARAM = { cantrips: "trucos", spells: "conjuros" } as const;
const TRI_PARAM = { yes: "si", no: "no" } as const;

/** Dirección con el filtro actual cambiado por `patch`: conserva `tab` y el resto, sin la ficha abierta ni el aviso de guardado, y omite lo de por defecto. */
export function spellTableHref(query: Query, patch: Partial<SpellTableFilter>): string {
  const f = { ...parseSpellTableFilter(query), ...patch };
  const params = new URLSearchParams();
  const tab = first(query.tab);
  if (tab) params.set("tab", tab);
  for (const [k, v] of Object.entries(query)) {
    if (FILTER_KEYS.has(k) || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) params.append(k, x);
  }
  if (f.q.trim()) params.set("q", f.q.trim());
  if (f.kind !== "all") params.set("tipo", KIND_PARAM[f.kind]);
  if (f.levels.length) params.set("nivel", f.levels.join(","));
  if (f.concentration !== "any") params.set("conc", TRI_PARAM[f.concentration]);
  if (f.ritual !== "any") params.set("ritual", TRI_PARAM[f.ritual]);
  const s = params.toString();
  return s ? `?${s}` : "?";
}

/** Filas por nivel (0 = trucos), ordenadas por nivel y nombre; sin niveles vacíos. */
export function groupByLevel(rows: SpellRow[]): { level: number; rows: SpellRow[] }[] {
  const byLevel = new Map<number, SpellRow[]>();
  for (const r of rows) byLevel.set(r.level, [...(byLevel.get(r.level) ?? []), r]);
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, rs]) => ({ level, rows: [...rs].sort((a, b) => a.name.localeCompare(b.name, "es")) }));
}

/** Dirección de la pestaña Conjuros con la vista de gestión (`?vista=gestionar`) o sin ella (la tabla); conserva el resto, menos la ficha abierta y el aviso de guardado. */
export function spellViewHref(query: Query, manage: boolean): string {
  const params = new URLSearchParams();
  params.set("tab", "conjuros");
  for (const [k, v] of Object.entries(query)) {
    if (k === "tab" || k === "vista" || k === "spell" || k === "saved" || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) params.append(k, x);
  }
  if (manage) params.set("vista", "gestionar");
  return `?${params.toString()}`;
}
