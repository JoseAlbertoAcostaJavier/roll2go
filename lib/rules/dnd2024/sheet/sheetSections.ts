// Secciones y filtros de las pestañas Rasgos y Trasfondo (spec de rasgos §3–4). Módulo puro.
import type { FeatureGroup } from "@/lib/rules/dnd2024/derive/features";

export type FeatureSection = "todo" | "clase" | "especie" | "dotes";

/** Chips de filtro de Rasgos, en orden; el id va en `?seccion=`. */
export const FEATURE_SECTION_CHIPS: { id: FeatureSection; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "clase", label: "Rasgos de clase" },
  { id: "especie", label: "Rasgos de especie" },
  { id: "dotes", label: "Dotes" },
];

export type BackgroundSection = "todo" | "trasfondo" | "caracteristicas" | "aspecto";

/** Chips de filtro de Trasfondo, en orden; el id va en `?seccion=`. */
export const BACKGROUND_SECTION_CHIPS: { id: BackgroundSection; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "trasfondo", label: "Trasfondo" },
  { id: "caracteristicas", label: "Características" },
  { id: "aspecto", label: "Aspecto" },
];

type Query = Record<string, string | string[] | undefined>;

/** Valor de `?seccion=`; si viene repetido, el primero. Desconocido o ausente → `todo`. */
export function parseSection<T extends string>(raw: unknown, ids: readonly T[]): T {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return ids.find((id) => id === value) ?? ("todo" as T);
}

/**
 * Dirección de un chip: la pestaña con la sección fijada (sin `seccion` con Todo) y el resto de parámetros (sin la
 * ficha de conjuro abierta ni el aviso de guardado).
 */
export function sectionHref(query: Query, section: string): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (k === "seccion" || k === "spell" || k === "saved" || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) params.append(k, x);
  }
  if (section !== "todo") params.set("seccion", section);
  return `?${params.toString()}`;
}

export type FeatureSectionGroup = { id: Exclude<FeatureSection, "todo">; title: string; groups: FeatureGroup[] };

const FEATURE_SECTION_DEFS: { id: Exclude<FeatureSection, "todo">; title: string; sources: FeatureGroup["source"][] }[] = [
  { id: "clase", title: "Rasgos de clase", sources: ["class", "subclass", "option"] },
  { id: "especie", title: "Rasgos de especie", sources: ["species", "lineage"] },
  { id: "dotes", title: "Dotes", sources: ["feat"] },
];

/**
 * Secciones de Rasgos con el filtro, en orden fijo y solo las que tengan grupos; dentro de cada una, los grupos
 * conservan su orden. Con «Todo», todas; con una sección, solo esa.
 */
export function featureSections(groups: FeatureGroup[], section: FeatureSection): FeatureSectionGroup[] {
  return FEATURE_SECTION_DEFS
    .filter((def) => section === "todo" || section === def.id)
    .map((def) => ({ id: def.id, title: def.title, groups: groups.filter((g) => def.sources.includes(g.source)) }))
    .filter((s) => s.groups.length > 0);
}
