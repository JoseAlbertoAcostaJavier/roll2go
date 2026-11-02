// Filtros y secciones de la pestaña Acciones (spec de acciones §4). Módulo puro.
import type { ActionGroup, ActionItem, ActionsSummary } from "@/lib/rules/dnd2024/derive/actions";
import type { ActionData } from "@/lib/rules/types";

export type ActionFilter = "todo" | "ataques" | ActionGroup;

/** Chips de filtro, en orden; el id va en `?filtro=`. */
export const ACTION_FILTERS: { id: ActionFilter; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "ataques", label: "Ataques" },
  { id: "action", label: "Acción" },
  { id: "bonus", label: "Acción adicional" },
  { id: "reaction", label: "Reacción" },
  { id: "other", label: "Otras" },
];

const GROUP_TITLES: Record<ActionGroup, string> = {
  action: "Acciones", bonus: "Acciones adicionales", reaction: "Reacciones", other: "Otras",
};

/** Filtro de `?filtro=`; desconocido o ausente → `todo`. */
export function parseActionFilter(raw: unknown): ActionFilter {
  return ACTION_FILTERS.find((f) => f.id === raw)?.id ?? "todo";
}

type Query = Record<string, string | string[] | undefined>;

/** Dirección de un chip: la pestaña Acciones con el filtro (sin él, Todo) y el resto de parámetros (sin la ficha de conjuro abierta ni el aviso de guardado). */
export function actionFilterHref(query: Query, filter: ActionFilter): string {
  const params = new URLSearchParams({ tab: "acciones" });
  for (const [k, v] of Object.entries(query)) {
    if (k === "tab" || k === "filtro" || k === "spell" || k === "saved" || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) params.append(k, x);
  }
  if (filter !== "todo") params.set("filtro", filter);
  return `?${params.toString()}`;
}

type Of<K extends ActionItem["kind"]> = Extract<ActionItem, { kind: K }>;
export type SpellAction = Of<"spell">;

export type ActionSection = {
  group: ActionGroup;
  title: string;
  /** Tabla de ataques: armas y conjuros con tirada (`hit`). */
  attacks: (Of<"attack"> | SpellAction)[];
  /** Conjuros sin tirada. */
  spells: SpellAction[];
  features: Of<"feature">[];
  /** «Acciones en combate». */
  basics: Of<"basic">[];
};

const isAttack = (i: ActionItem): i is Of<"attack"> | SpellAction =>
  i.kind === "attack" || (i.kind === "spell" && i.hit !== null);

/**
 * Secciones que se muestran con el filtro, en orden y solo si tienen algo. Con «Ataques», solo las tablas de ataques;
 * con un grupo, solo su sección. Cada lista conserva el orden de `items`.
 */
export function actionSections(summary: ActionsSummary, filter: ActionFilter): ActionSection[] {
  const groups = (Object.keys(GROUP_TITLES) as ActionGroup[]).filter((g) => filter === "todo" || filter === "ataques" || filter === g);
  return groups
    .map((group): ActionSection => {
      const items = summary.items.filter((i) => i.group === group);
      const attacks = items.filter(isAttack);
      if (filter === "ataques") return { group, title: GROUP_TITLES[group], attacks, spells: [], features: [], basics: [] };
      return {
        group,
        title: GROUP_TITLES[group],
        attacks,
        spells: items.filter((i): i is SpellAction => i.kind === "spell" && i.hit === null),
        features: items.filter((i): i is Of<"feature"> => i.kind === "feature"),
        basics: items.filter((i): i is Of<"basic"> => i.kind === "basic"),
      };
    })
    .filter((s) => s.attacks.length + s.spells.length + s.features.length + s.basics.length > 0);
}

/** Qué partes de una sección se ven en pantalla con el filtro; al imprimir se muestran todas. */
export type SectionVisibility = { section: boolean; attacks: boolean; spells: boolean; features: boolean; basics: boolean };

/**
 * Visibilidad en pantalla de una sección construida con `actionSections(summary, "todo")`: con «Ataques» solo las
 * tablas (y solo las secciones que tengan), con un grupo solo su sección, con «Todo» todo.
 */
export function sectionVisibility(section: ActionSection, filter: ActionFilter): SectionVisibility {
  if (filter === "todo") return { section: true, attacks: true, spells: true, features: true, basics: true };
  if (filter === "ataques") {
    const has = section.attacks.length > 0;
    return { section: has, attacks: has, spells: false, features: false, basics: false };
  }
  const on = section.group === filter;
  return { section: on, attacks: on, spells: on, features: on, basics: on };
}

/** Cuánto cuesta una acción básica (`ActionData.time`), para su diálogo. */
export const ACTION_TIME_LABELS: Record<ActionData["time"], string> = {
  action: "Acción", bonus: "Acción adicional", reaction: "Reacción", free: "Gratuita", varies: "Variable",
};
