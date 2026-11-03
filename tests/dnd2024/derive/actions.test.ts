import { describe, expect, it } from "vitest";
import type { CatalogEntry, SpellOption } from "@/lib/rules/catalog/types";
import { deriveActions, withSpellEntries, type ActionItem } from "@/lib/rules/dnd2024/derive/actions";
import type { FeatureUse } from "@/lib/rules/dnd2024/derive/featureUses";
import { unarmedAttack } from "@/lib/rules/dnd2024/derive/attacks";
import type { FeatureGroup } from "@/lib/rules/dnd2024/derive/features";
import type { CasterBlock, SpellsSummary } from "@/lib/rules/dnd2024/derive/spells";
import type { ActionData, Activation, FeatureData, Ref, SpellData } from "@/lib/rules/types";

const B = "b";
const ref = (key: string): Ref => ({ book: B, key });
const entry = (key: string, name: string, data: unknown, nameEs: string | null = null): CatalogEntry => ({
  ref: ref(key), name, nameEs, bookName: "Libro", srd52: false, data, description: "", descriptionEs: "",
  identifier: "", parent: null, foundry: null,
});
const spell = (key: string, nameEs: string, level: number, time: string, tags: string[] = [], range = "18 metros"):
  CatalogEntry => entry(key, key, {
  level, school: "V", time, range, components: "V, S", duration: "Instantáneo", concentration: false, ritual: false,
  classes: ["wizard"], tags,
} satisfies SpellData, nameEs);
const feature = (key: string, level: number, activation?: Activation) =>
  entry(key, key, { level, className: "Fighter", ...(activation ? { activation } : {}) } satisfies FeatureData);
const basic = (key: string, nameEs: string, time: ActionData["time"]) => entry(key, key, { time } satisfies ActionData, nameEs);

const SPELLS = [
  spell("spell:ray of frost|xphb", "Rayo de escarcha", 0, "1 acción", ["Daño de frío", "Ataque de conjuro"], "18 metros (60 pies)"),
  spell("spell:shield|xphb", "Escudo", 1, "1 reacción"),
  spell("spell:detect magic|xphb", "Detectar magia", 1, "1 acción"),
  spell("spell:identify|xphb", "Identificar", 1, "1 minuto"),
  spell("spell:sleep|xphb", "Dormir", 1, "1 acción", ["Salvación de Sabiduría"]),
  spell("spell:misty step|xphb", "Paso brumoso", 2, "1 acción adicional"),
  spell("spell:burning hands|xphb", "Manos ardientes", 1, "1 acción", ["Daño de fuego", "Salvación de Destreza"]),
  spell("spell:fire bolt|xphb", "Descarga de fuego", 0, "1 acción", ["Daño de fuego", "Ataque de conjuro"]),
];
const FEATURES = [
  feature("classFeature:second wind|fighter|xphb|1", 1, "bonus"),
  feature("classFeature:fighting style|fighter|xphb|1", 1),
  feature("classFeature:action surge|fighter|xphb|2", 2),
  feature("subclassFeature:parry|fighter|xphb|3", 3, "reaction"),
];
const BASICS = [
  basic("action:opportunity attack|xphb", "Ataque de oportunidad", "reaction"),
  basic("action:dash|xphb", "Correr", "action"),
  basic("action:end concentration|xphb", "Terminar la concentración", "free"),
  basic("action:attack|xphb", "Atacar", "action"),
  basic("action:two-weapon fighting|xphb", "Combate con dos armas", "bonus"),
];
const entries = new Map([...SPELLS, ...FEATURES].map((e) => [`${B}:${e.ref.key}`, e]));

const block = (b: Partial<CasterBlock>): CasterBlock => ({
  class: ref("class:wizard|xphb"), name: "Mago", ability: "int", mode: "spellbook", dc: 13, attack: 5,
  cantripLimit: 3, preparedLimit: 4, maxSpellLevel: 1, known: [], cantrips: [], prepared: [], spellbook: [],
  always: [], limited: [], ...b,
});
const summary = (blocks: CasterBlock[], other: SpellsSummary["other"] = []): SpellsSummary =>
  ({ blocks, slots: { levels: {}, pact: null }, other, used: {}, limitedUsed: {} });
const named = (key: string, name = key) => ({ ref: ref(key), name });

const wizard = summary([block({
  cantrips: [named("spell:ray of frost|xphb", "Rayo de escarcha")],
  spellbook: [named("spell:shield|xphb"), named("spell:detect magic|xphb"), named("spell:identify|xphb"),
    named("spell:sleep|xphb"), named("spell:burning hands|xphb")],
  prepared: [ref("spell:shield|xphb"), ref("spell:detect magic|xphb"), ref("spell:identify|xphb"),
    ref("spell:burning hands|xphb")],
})], [{ spell: named("spell:misty step|xphb", "Paso brumoso"), origin: "Especie: Tiefling" }]);

const fighterGroups = (extra: string[] = []): FeatureGroup[] => [
  { title: "Humano", source: "species", ref: ref("species:human|xphb"), features: [] },
  {
    title: "Guerrero", source: "class", ref: ref("class:fighter|xphb"), level: 3,
    features: [
      { ref: ref("classFeature:fighting style|fighter|xphb|1"), name: "Estilo de combate", level: 1 },
      { ref: ref("classFeature:second wind|fighter|xphb|1"), name: "Nuevas energías", level: 1 },
      { ref: ref("classFeature:action surge|fighter|xphb|2"), name: "Oleada de acción", level: 2 },
      ...extra.map((k) => ({ ref: ref(k), name: k, level: 5 })),
    ],
  },
  {
    title: "Campeón", source: "subclass", ref: ref("subclass:champion|fighter|xphb"), level: 3,
    features: [{ ref: ref("subclassFeature:parry|fighter|xphb|3"), name: "Parada", level: 3 }],
  },
];

const fist = unarmedAttack({ str: 3, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, 2, null);
const run = (spells = summary([]), features: FeatureGroup[] = [], attacks = [fist], featureUses: FeatureUse[] = [],
  ents = entries) => deriveActions({ attacks, spells, features, featureUses, basics: BASICS, entries: ents });
const spellItem = (items: ActionItem[], name: string) =>
  items.find((i): i is Extract<ActionItem, { kind: "spell" }> => i.kind === "spell" && i.name === name);

describe("deriveActions: conjuros", () => {
  const { items } = run(wizard);
  it("truco de ataque en Acciones con «+N» y el tipo de daño", () => {
    expect(spellItem(items, "Rayo de escarcha")).toEqual({
      kind: "spell", group: "action", ref: ref("spell:ray of frost|xphb"), name: "Rayo de escarcha", level: 0,
      range: "18 metros (60 pies)", hit: "+5", damage: null, damageTypeId: "cold", notes: "Mago",
    });
  });
  it("agrupa por el tiempo de lanzamiento", () => {
    expect(spellItem(items, "Escudo")?.group).toBe("reaction");
    expect(spellItem(items, "Detectar magia")?.group).toBe("action");
    expect(spellItem(items, "Identificar")?.group).toBe("other");
    expect(spellItem(items, "Paso brumoso")?.group).toBe("bonus");
  });
  it("salvación: «CD N» con la abreviatura de la característica", () => {
    expect(spellItem(items, "Manos ardientes")).toMatchObject({ hit: "CD 13 DES", damageTypeId: "fire" });
    expect(spellItem(items, "Detectar magia")).toMatchObject({ hit: null, damageTypeId: null });
  });
  it("del libro, solo los preparados", () => {
    expect(spellItem(items, "Dormir")).toBeUndefined();
  });
  it("los de especie y dotes, con su origen y sin tirada (no se sabe su característica)", () => {
    expect(spellItem(items, "Paso brumoso")).toMatchObject({ notes: "Especie: Tiefling", hit: null });
  });
  it("aprendidos, siempre preparados y con usos; sin repetir", () => {
    const sorcerer = summary([block({
      class: ref("class:sorcerer|xphb"), name: "Hechicero", mode: "levelUp", ability: "cha", dc: 14, attack: 6,
      known: [named("spell:sleep|xphb", "Dormir")], prepared: [ref("spell:sleep|xphb")],
      always: [{ spell: named("spell:shield|xphb", "Escudo"), origin: "Mente aberrante" }],
      limited: [{ key: "k", spell: named("spell:identify|xphb", "Identificar"), origin: "Arcano místico", max: 1, used: 0 }],
    })]);
    const out = run(sorcerer).items.filter((i) => i.kind === "spell");
    expect(out.map((i) => i.kind === "spell" && i.name)).toEqual(["Dormir", "Escudo", "Identificar"]);
    expect(spellItem(out, "Dormir")?.hit).toBe("CD 14 SAB");
    expect(spellItem(out, "Escudo")?.notes).toBe("Mente aberrante");
  });
});

describe("deriveActions: rasgos y básicas", () => {
  const { items } = run(summary([]), fighterGroups());
  const features = items.filter((i) => i.kind === "feature");
  it("rasgos con activación en su grupo, con la clase o subclase de origen; los pasivos no salen", () => {
    expect(features).toEqual([
      { kind: "feature", group: "bonus", ref: ref("classFeature:second wind|fighter|xphb|1"), name: "Nuevas energías", source: "Guerrero", special: false },
      { kind: "feature", group: "reaction", ref: ref("subclassFeature:parry|fighter|xphb|3"), name: "Parada", source: "Campeón", special: false },
    ]);
  });
  it("básicas por su tiempo (gratuitas y variables en Otras), con icono", () => {
    const basics = items.filter((i) => i.kind === "basic");
    const byName = (n: string) => basics.find((b) => b.kind === "basic" && b.name === n);
    expect(byName("Ataque de oportunidad")).toMatchObject({ group: "reaction", icon: "/assets/icons/dark/actions/opportunity-attack.svg" });
    expect(byName("Correr")?.group).toBe("action");
    expect(byName("Terminar la concentración")?.group).toBe("other");
    expect(byName("Combate con dos armas")?.group).toBe("bonus");
  });
});

describe("deriveActions: rasgos con usos", () => {
  const rageKey = "classFeature:rage|barbarian|xphb|1";
  const rage: FeatureUse = { key: `${B}:${rageKey}`, name: "Furia", max: 2, used: 1, recovery: { long: "all", short: 1 } };
  const relentlessKey = "species:dwarf|xphb";
  const relentless: FeatureUse = {
    key: `${B}:${relentlessKey}`, name: "Aguante incansable", max: 1, used: 0, recovery: { long: "all", short: "none" },
  };
  const ents = new Map([...entries, ...[feature(rageKey, 1, "bonus")].map((e) => [`${B}:${e.ref.key}`, e] as const)]);
  const groups: FeatureGroup[] = [
    { title: "Enano", source: "species", ref: ref(relentlessKey), features: [] },
    {
      title: "Bárbaro", source: "class", ref: ref("class:barbarian|xphb"), level: 1,
      features: [
        { ref: ref(rageKey), name: "Furia", level: 1 },
        { ref: ref("classFeature:unarmored defense|barbarian|xphb|1"), name: "Defensa sin armadura", level: 1 },
      ],
    },
  ];
  const { items } = run(summary([]), groups, [], [rage, relentless], ents);
  const features = items.filter((i) => i.kind === "feature");
  it("Furia en acción adicional con sus usos", () => {
    expect(features.find((f) => f.name === "Furia")).toMatchObject({ group: "bonus", special: false, uses: { max: 2, used: 1 } });
  });
  it("rasgo de especie con usos en Otras, con su nombre de contador y «especial»", () => {
    expect(features.find((f) => f.name === "Aguante incansable")).toMatchObject({
      group: "other", source: "Enano", special: true, uses: { max: 1 },
    });
  });
  it("un rasgo sin usos ni activación no aparece", () => {
    expect(features.map((f) => f.name)).toEqual(["Furia", "Aguante incansable"]);
  });
});

describe("deriveActions: ataques por acción", () => {
  const per = (...keys: string[]) => run(summary([]), fighterGroups(keys)).attacksPerAction;
  it("1, 2 con Ataque adicional, 3 y 4 con los del Guerrero", () => {
    expect(per()).toBe(1);
    expect(per("classFeature:extra attack|fighter|xphb|5")).toBe(2);
    expect(per("classFeature:extra attack|fighter|xphb|5", "classFeature:two extra attacks|fighter|xphb|11")).toBe(3);
    expect(per("classFeature:extra attack|fighter|xphb|5", "classFeature:two extra attacks|fighter|xphb|11",
      "classFeature:three extra attacks|fighter|xphb|20")).toBe(4);
  });
  it("Ataque adicional de una subclase también cuenta", () => {
    const groups: FeatureGroup[] = [{
      title: "Cantor de la hoja", source: "subclass", ref: ref("subclass:bladesinger|wizard|xphb"), level: 6,
      features: [{ ref: ref("subclassFeature:extra attack|wizard|xphb|bladesinger|xphb|6"), name: "Ataque adicional", level: 6 }],
    }];
    expect(run(summary([]), groups).attacksPerAction).toBe(2);
  });
});

describe("deriveActions: orden", () => {
  it("por grupo; dentro, armas → conjuros (nivel y nombre) → rasgos (nivel) → básicas (nombre)", () => {
    const { items } = run(wizard, fighterGroups());
    const label = (i: ActionItem) => `${i.group}:${i.kind === "attack" ? i.attack.name : i.name}`;
    expect(items.map(label)).toEqual([
      "action:Ataque sin armas",
      "action:Rayo de escarcha",
      "action:Detectar magia",
      "action:Manos ardientes",
      "action:Atacar",
      "action:Correr",
      "bonus:Paso brumoso",
      "bonus:Nuevas energías",
      "bonus:Combate con dos armas",
      "reaction:Escudo",
      "reaction:Parada",
      "reaction:Ataque de oportunidad",
      "other:Identificar",
      "other:Terminar la concentración",
    ]);
  });
  it("conjuros del mismo nivel por nombre", () => {
    const cantrips = summary([block({
      cantrips: [named("spell:ray of frost|xphb", "Rayo de escarcha"), named("spell:fire bolt|xphb", "Descarga de fuego")],
    })]);
    const names = run(cantrips, [], []).items.flatMap((i) => (i.kind === "spell" ? [i.name] : []));
    expect(names).toEqual(["Descarga de fuego", "Rayo de escarcha"]);
  });
});

// Como en la página: el catálogo de la ficha solo trae rasgos (no conjuros) y los conjuros llegan del listado de la
// pestaña Conjuros (`SpellOption`, sin descripción)
describe("withSpellEntries: conjuros del listado", () => {
  const sheetEntries = new Map(FEATURES.map((e) => [`${B}:${e.ref.key}`, e]));
  const options: SpellOption[] = SPELLS.map((e) => ({
    ref: e.ref, name: e.name, nameEs: e.nameEs, bookName: e.bookName, srd52: false, data: e.data as SpellData, summary: "",
  }));
  const spellNames = (m: Map<string, CatalogEntry>) =>
    deriveActions({ attacks: [], spells: wizard, features: [], featureUses: [], basics: [], entries: m }).items
      .flatMap((i) => (i.kind === "spell" ? [i.name] : []));

  it("sin los conjuros en el mapa no sale ninguno", () => {
    expect(spellNames(sheetEntries)).toEqual([]);
  });
  it("con el listado añadido salen los trucos, los preparados y los de especie", () => {
    expect(spellNames(withSpellEntries(sheetEntries, options))).toEqual([
      "Rayo de escarcha", "Detectar magia", "Manos ardientes", "Paso brumoso", "Escudo", "Identificar",
    ]);
  });
  it("conserva las entradas que ya estaban", () => {
    const merged = withSpellEntries(sheetEntries, options);
    for (const [k, e] of sheetEntries) expect(merged.get(k)).toBe(e);
  });
});
