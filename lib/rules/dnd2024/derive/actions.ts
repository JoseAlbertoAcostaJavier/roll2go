// Acciones de la ficha (spec de acciones §3): armas, conjuros utilizables, rasgos de clase y subclase con activación y
// acciones básicas de combate, agrupados por lo que cuesta usarlos. Función pura sobre lo que ya calcula `derive`.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { actionIcon } from "@/lib/rules/dnd2024/sheet/actionIcons";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { ABILITY_ABBR, ABILITY_NAMES, DAMAGE_TYPE_NAMES, fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import type { Ability, ActionData, FeatureData, Ref, SpellData } from "@/lib/rules/types";
import type { Attack } from "./attacks";
import type { FeatureGroup } from "./features";
import type { CasterBlock, SpellsSummary } from "./spells";

export type ActionGroup = "action" | "bonus" | "reaction" | "other";
export type ActionItem =
  | { kind: "attack"; group: "action"; attack: Attack }
  | {
    kind: "spell"; group: ActionGroup; ref: Ref; name: string; level: number;
    range: string; hit: string | null; damage: string | null; damageTypeId: string | null; notes: string;
  }
  | { kind: "feature"; group: Exclude<ActionGroup, "other">; ref: Ref; name: string; source: string }
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
  /** Catálogo con los conjuros y los rasgos del personaje (por `refKey`). */
  entries: Map<string, CatalogEntry>;
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

// «Daño de fuego» / «Daño necrótico» → "fire" / "necrotic" (etiquetas de `spellTags`)
const DAMAGE_IDS = new Map(Object.entries(DAMAGE_TYPE_NAMES).map(([id, name]) => [name.toLowerCase(), id]));
const damageIdOf = (tag: string) => {
  const m = /^Daño (?:de )?(.+)$/.exec(tag);
  return m ? (DAMAGE_IDS.get(m[1].toLowerCase()) ?? null) : null;
};
// «Salvación de Destreza» → "dex"
const SAVE_ABILITIES = new Map(Object.entries(ABILITY_NAMES).map(([a, name]) => [`Salvación de ${name}`, a as Ability]));
const SPELL_ATTACK_TAG = "Ataque de conjuro";

// Ataque adicional (de cualquier clase o subclase) y los del Guerrero, por el nombre en la clave del rasgo
const featureName = (ref: Ref) => ref.key.replace(/^[^:]*:/, "");
const EXTRA_ATTACKS: [string, number][] = [["three extra attacks|", 3], ["two extra attacks|", 2], ["extra attack|", 1]];

// «+N» con ataque de conjuro, «CD N {Car}» con salvación; null sin tirada o sin bloque lanzador (especie, dotes: no
// se guarda con qué característica los lanza)
function hitOf(tags: string[], block: CasterBlock | null): string | null {
  if (!block) return null;
  if (tags.includes(SPELL_ATTACK_TAG)) return fmtMod(block.attack);
  const save = tags.map((t) => SAVE_ABILITIES.get(t)).find((a) => a);
  return save ? `CD ${block.dc} ${ABILITY_ABBR[save]}` : null;
}

// Conjuros que se pueden lanzar, como en la pestaña Conjuros: trucos, preparados (en modo `levelUp`, los aprendidos;
// en el Mago, los preparados de su libro), siempre preparados y con usos de cada bloque, y los de especie, legado y
// dotes; cada uno una vez (el primero que aparece)
function spellItems(spells: SpellsSummary, entries: Map<string, CatalogEntry>): ActionItem[] {
  const sources: { ref: Ref; block: CasterBlock | null; origin: string }[] = [
    ...spells.blocks.flatMap((b) => [
      ...b.cantrips.map((n) => ({ ref: n.ref, block: b, origin: b.name })),
      ...b.prepared.map((r) => ({ ref: r, block: b, origin: b.name })),
      ...b.always.map((a) => ({ ref: a.spell.ref, block: b, origin: a.origin })),
      ...b.limited.map((l) => ({ ref: l.spell.ref, block: b, origin: l.origin })),
    ]),
    ...spells.other.map((o) => ({ ref: o.spell.ref, block: null, origin: o.origin })),
  ];
  const seen = new Set<string>();
  const out: ActionItem[] = [];
  for (const s of sources) {
    const key = refKey(s.ref);
    const entry = entries.get(key);
    // Sin entrada en el catálogo no se sabe cuánto cuesta lanzarlo (derive ya lo avisa en `missing`)
    if (seen.has(key) || !entry) continue;
    seen.add(key);
    const data = entry.data as SpellData;
    const damageTypeId = data.tags.map(damageIdOf).find((d) => d) ?? null;
    out.push({
      kind: "spell", group: spellGroup(data.time), ref: s.ref, name: entry.nameEs ?? entry.name,
      level: data.level, range: data.range, hit: hitOf(data.tags, s.block),
      // El catálogo no guarda los dados de daño de los conjuros
      damage: null, damageTypeId, notes: s.origin,
    });
  }
  return out.sort((a, b) => (a.kind === "spell" && b.kind === "spell"
    ? a.level - b.level || a.name.localeCompare(b.name, "es") : 0));
}

export function deriveActions(input: ActionsInput): ActionsSummary {
  const { attacks, spells, features, basics, entries } = input;
  const classFeatures = features.filter((g) => g.source === "class" || g.source === "subclass")
    .flatMap((g) => g.features.map((f) => ({ ...f, source: g.title })));

  const extra = Math.max(0, ...classFeatures.map((f) =>
    EXTRA_ATTACKS.find(([prefix]) => featureName(f.ref).startsWith(prefix))?.[1] ?? 0));

  const featureItems: ActionItem[] = classFeatures
    .flatMap((f) => {
      const activation = (entries.get(refKey(f.ref))?.data as FeatureData | undefined)?.activation;
      return activation ? [{ ...f, activation }] : [];
    })
    .sort((a, b) => a.level - b.level)
    .map((f) => ({ kind: "feature", group: f.activation, ref: f.ref, name: f.name, source: f.source }));

  const basicItems: ActionItem[] = basics
    .map((e): ActionItem => ({
      kind: "basic", group: BASIC_GROUPS[(e.data as ActionData).time] ?? "other", ref: e.ref, name: e.nameEs ?? e.name,
      icon: actionIcon(e.ref.key),
    }))
    .sort((a, b) => (a.kind === "basic" && b.kind === "basic" ? a.name.localeCompare(b.name, "es") : 0));

  const items: ActionItem[] = [
    ...attacks.map((attack): ActionItem => ({ kind: "attack", group: "action", attack })),
    ...spellItems(spells, entries),
    ...featureItems,
    ...basicItems,
  ];
  // Orden estable: por grupo y, dentro, armas → conjuros → rasgos → básicas (cada tipo ya va ordenado)
  const rank = (i: ActionItem) => GROUP_ORDER.indexOf(i.group) * KIND_ORDER.length + KIND_ORDER.indexOf(i.kind);
  return { attacksPerAction: 1 + extra, items: items.sort((a, b) => rank(a) - rank(b)) };
}
