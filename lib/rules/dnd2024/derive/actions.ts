// Acciones de la ficha (spec de acciones §3): armas, conjuros utilizables, rasgos de clase y subclase con activación y
// acciones básicas de combate, agrupados por lo que cuesta usarlos. Función pura sobre lo que ya calcula `derive`.
import type { CatalogEntry, SpellOption } from "@/lib/rules/catalog/types";
import { actionIcon } from "@/lib/rules/dnd2024/sheet/actionIcons";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { damageIdOf, hitOf, spellDamageAt, usableSpells } from "@/lib/rules/dnd2024/spells/spellTable";
import { spellLevelLabel } from "@/lib/rules/dnd2024/spells/spellTextClient";
import type { ActionData, Activation, FeatureData, Ref, SpellData } from "@/lib/rules/types";
import type { Attack } from "./attacks";
import type { FeatureUse } from "./featureUses";
import type { FeatureGroup } from "./features";
import type { SpellsSummary } from "./spells";

export type ActionGroup = "action" | "bonus" | "reaction" | "other";
export type ActionItem =
  | { kind: "attack"; group: "action"; attack: Attack }
  | {
    kind: "spell"; group: ActionGroup; ref: Ref; name: string; level: number;
    /** Escuela de 5etools (`V`), para su icono. */
    school: string;
    range: string; hit: string | null; damage: string | null; damageTypeId: string | null;
    /** «Truco · Mago», «Nivel 1 · Dote: Iniciado en la magia (mago)». */
    subtitle: string;
    /** Componentes (solo las letras), «Concentración» y «Ritual»: «V, S · Concentración · Ritual». */
    notes: string;
  }
  | {
    kind: "feature"; group: ActionGroup; ref: Ref; name: string; source: string;
    /** Sin acción, acción adicional ni reacción propias (se usa de otra forma): «(Especial)». */
    special: boolean;
    uses?: FeatureUse;
  }
  | { kind: "basic"; group: ActionGroup; ref: Ref; name: string; icon: string | null };
export type ActionsSummary = { attacksPerAction: number; items: ActionItem[] };

export type ActionsInput = {
  /** Ataques con armas y sin armas (`Derived.attacks`). */
  attacks: Attack[];
  /** `Derived.spells`. */
  spells: SpellsSummary;
  /** `Derived.features`: de los grupos de clase y subclase salen los rasgos y Ataque adicional. */
  features: FeatureGroup[];
  /** Entradas `action` del catálogo de los libros del personaje. */
  basics: CatalogEntry[];
  /** `Derived.featureUses`: los rasgos con contador salen también aunque no tengan activación (en «Otras»). */
  featureUses: FeatureUse[];
  /** Catálogo con los conjuros y los rasgos del personaje (por `refKey`). */
  entries: Map<string, CatalogEntry>;
  /** Nivel total del personaje (los dados de los trucos suben con él). */
  level: number;
};

const GROUP_ORDER: ActionGroup[] = ["action", "bonus", "reaction", "other"];
const KIND_ORDER: ActionItem["kind"][] = ["attack", "spell", "feature", "basic"];

// Grupo por el tiempo de lanzamiento en español («1 acción adicional», «1 reacción», «1 acción», «1 minuto»…)
const spellGroup = (time: string): ActionGroup =>
  time.startsWith("1 acción adicional") ? "bonus"
    : time.startsWith("1 reacción") ? "reaction"
      : time.startsWith("1 acción") ? "action"
        : "other";

const BASIC_GROUPS: Record<ActionData["time"], ActionGroup> = {
  action: "action", bonus: "bonus", reaction: "reaction", free: "other", varies: "other",
};

// Ataque adicional (de cualquier clase o subclase) y los del Guerrero, por el nombre en la clave del rasgo
const featureName = (ref: Ref) => ref.key.replace(/^[^:]*:/, "");
const EXTRA_ATTACKS: [string, number][] = [["three extra attacks|", 3], ["two extra attacks|", 2], ["extra attack|", 1]];

// «V, S, M (un trozo de hierro)» → «V, S, M»; con «Concentración» y «Ritual»
const spellNotes = (data: SpellData) => [
  data.components.replace(/\s*\(.*\)/, "").trim(), data.concentration ? "Concentración" : "", data.ritual ? "Ritual" : "",
].filter(Boolean).join(" · ");

// Conjuros que se pueden lanzar (los mismos que en la tabla de conjuros), con su tirada y tipo de daño
function spellItems(spells: SpellsSummary, entries: Map<string, CatalogEntry>, level: number): ActionItem[] {
  const out: ActionItem[] = usableSpells(spells, entries).map(({ ref, caster, origin, entry, data }) => ({
    kind: "spell", group: spellGroup(data.time), ref, name: entry.nameEs ?? entry.name,
    level: data.level, school: data.school, range: data.range, hit: hitOf(data.tags, caster),
    damage: spellDamageAt(data, level), damageTypeId: data.tags.map(damageIdOf).find((d) => d) ?? null,
    subtitle: `${spellLevelLabel(data.level)} · ${origin}`, notes: spellNotes(data),
  }));
  return out.sort((a, b) => (a.kind === "spell" && b.kind === "spell"
    ? a.level - b.level || a.name.localeCompare(b.name, "es") : 0));
}

/**
 * El catálogo de la ficha (`loadSheetEntries`) no trae los conjuros: van aparte, en el listado de la pestaña Conjuros
 * (`SpellOption`, sin descripción). Esta función los añade al mapa para `deriveActions`, que solo usa su nombre y
 * sus datos; las entradas que ya estaban se conservan.
 */
export function withSpellEntries(entries: Map<string, CatalogEntry>, spells: SpellOption[]): Map<string, CatalogEntry> {
  const out = new Map(entries);
  for (const s of spells) {
    const key = refKey(s.ref);
    if (!out.has(key)) {
      out.set(key, { ...s, description: "", descriptionEs: "", identifier: "", page: null, parent: null, foundry: null });
    }
  }
  return out;
}

export function deriveActions(input: ActionsInput): ActionsSummary {
  const { attacks, spells, features, featureUses, basics, entries, level } = input;
  const classFeatures = features.filter((g) => g.source === "class" || g.source === "subclass")
    .flatMap((g) => g.features);

  const extra = Math.max(0, ...classFeatures.map((f) =>
    EXTRA_ATTACKS.find(([prefix]) => featureName(f.ref).startsWith(prefix))?.[1] ?? 0));

  // Rasgos de clase y subclase con activación y cualquier rasgo con usos (la especie y el legado sin rasgos propios
  // cuentan como un solo rasgo, como en `featureUses`)
  const candidates = features.flatMap((g) => {
    const own = g.source === "class" || g.source === "subclass";
    const list = g.features.length === 0 && g.ref && (g.source === "species" || g.source === "lineage")
      ? [{ ref: g.ref, name: g.title, level: 0 }] : g.features;
    return list.map((f) => ({ ...f, source: g.title, own }));
  });
  const featureItems: ActionItem[] = candidates
    .flatMap((f) => {
      type Candidate = typeof f & { activation: Activation | undefined; uses: FeatureUse | undefined; label: string };
      const activation = f.own ? (entries.get(refKey(f.ref))?.data as FeatureData | undefined)?.activation : undefined;
      // Un rasgo puede tener varios contadores (especie): un ítem por cada uno
      const uses = featureUses.filter((u) => u.key === refKey(f.ref) || u.owner === refKey(f.ref));
      if (uses.length === 0) return activation ? [{ ...f, activation, uses: undefined, label: f.name } as Candidate] : [];
      return uses.map((u): Candidate => ({ ...f, activation: u.activation ?? activation, uses: u, label: u.name }));
    })
    .sort((a, b) => a.level - b.level)
    .map((f): ActionItem => ({
      kind: "feature", group: f.activation ?? "other", ref: f.ref, name: f.label, source: f.source,
      special: !f.activation, ...(f.uses ? { uses: f.uses } : {}),
    }));

  const basicItems: ActionItem[] = basics
    .map((e): ActionItem => ({
      kind: "basic", group: BASIC_GROUPS[(e.data as ActionData).time] ?? "other", ref: e.ref, name: e.nameEs ?? e.name,
      icon: actionIcon(e.ref.key),
    }))
    .sort((a, b) => (a.kind === "basic" && b.kind === "basic" ? a.name.localeCompare(b.name, "es") : 0));

  const items: ActionItem[] = [
    ...attacks.map((attack): ActionItem => ({ kind: "attack", group: "action", attack })),
    ...spellItems(spells, entries, level),
    ...featureItems,
    ...basicItems,
  ];
  // Orden estable: por grupo y, dentro, armas → conjuros → rasgos → básicas (cada tipo ya va ordenado)
  const rank = (i: ActionItem) => GROUP_ORDER.indexOf(i.group) * KIND_ORDER.length + KIND_ORDER.indexOf(i.kind);
  return { attacksPerAction: 1 + extra, items: items.sort((a, b) => rank(a) - rank(b)) };
}
