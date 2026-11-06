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
  identifier: "", page: null, parent: null, foundry: null,
});
const spell = (key: string, nameEs: string, level: number, time: string, tags: string[] = [], range = "18 metros", damage?: SpellData["damage"]):
  CatalogEntry => entry(key, key, {
  level, school: "V", time, range, components: "V, S", duration: "Instantáneo", concentration: false, ritual: false,
  classes: ["wizard"], tags, ...(damage ? { damage } : {}),
} satisfies SpellData, nameEs);
const feature = (key: string, level: number, activation?: Activation) =>
  entry(key, key, { level, className: "Fighter", ...(activation ? { activation } : {}) } satisfies FeatureData);
const basic = (key: string, nameEs: string, time: ActionData["time"]) => entry(key, key, { time } satisfies ActionData, nameEs);

const SPELLS = [
  spell("spell:ray of frost|xphb", "Rayo de escarcha", 0, "1 acción", ["Daño de frío", "Ataque de conjuro"], "18 metros (60 pies)"),
  spell("spell:shield|xphb", "Escudo", 1, "1 reacción"),
  entry("spell:detect magic|xphb", "detect magic", {
    level: 1, school: "D", time: "1 acción", range: "Propia", components: "V, S, M (un trozo de hierro)", duration: "10 minutos",
    concentration: true, ritual: true, classes: ["wizard"], tags: [],
  } satisfies SpellData, "Detectar magia"),
  spell("spell:shocking grasp|xphb", "Agarre electrizante", 0, "1 acción", ["Daño de relámpago", "Ataque de conjuro"], "Toque", { dice: "1d8" }),
  spell("spell:identify|xphb", "Identificar", 1, "1 minuto"),
  spell("spell:sleep|xphb", "Dormir", 1, "1 acción", ["Salvación de Sabiduría"]),
  spell("spell:misty step|xphb", "Paso brumoso", 2, "1 acción adicional"),
  spell("spell:burning hands|xphb", "Manos ardientes", 1, "1 acción", ["Daño de fuego", "Salvación de Destreza"], "Propia", { dice: "3d6" }),
  spell("spell:fire bolt|xphb", "Descarga de fuego", 0, "1 acción", ["Daño de fuego", "Ataque de conjuro"], "36 metros", {
    dice: "1d10", scaling: [{ level: 1, dice: "1d10" }, { level: 5, dice: "2d10" }, { level: 11, dice: "3d10" }, { level: 17, dice: "4d10" }],
  }),
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
  ents = entries, level = 1) => deriveActions({ attacks, spells, features, featureUses, basics: BASICS, entries: ents, level });
const spellItem = (items: ActionItem[], name: string) =>
  items.find((i): i is Extract<ActionItem, { kind: "spell" }> => i.kind === "spell" && i.name === name);

describe("deriveActions: curación", () => {
  const cure = (healing: boolean) => {
    const e = entry("spell:cure wounds|xphb", "cure wounds", {
      level: 1, school: "A", time: "1 acción", range: "Toque", components: "V, S", duration: "Instantáneo",
      concentration: false, ritual: false, classes: ["cleric"], tags: [], ...(healing ? { healing: { dice: "2d8" } } : {}),
    } satisfies SpellData, "Curar heridas");
    const s = summary([block({ prepared: [ref("spell:cure wounds|xphb")] })]);
    return spellItem(run(s, [], [fist], [], new Map([[`${B}:${e.ref.key}`, e]])).items, "Curar heridas")!;
  };
  it("los dados de curación van en damage, con healing y sin tipo de daño; sin tirada, como los de daño sin ataque", () => {
    expect(cure(true)).toMatchObject({ damage: "2d8", healing: true, damageTypeId: null, hit: null });
  });
  it("sin healing en los datos, como antes", () => {
    const item = cure(false);
    expect(item).toMatchObject({ damage: null, damageTypeId: null });
    expect(item).not.toHaveProperty("healing");
  });
});

describe("deriveActions: conjuros", () => {
  const { items } = run(wizard);
  it("truco de ataque en Acciones con «+N» y el tipo de daño", () => {
    expect(spellItem(items, "Rayo de escarcha")).toEqual({
      kind: "spell", group: "action", ref: ref("spell:ray of frost|xphb"), name: "Rayo de escarcha", level: 0,
      range: "18 metros (60 pies)", hit: "+5", damage: null, school: "V", damageTypeId: "cold", subtitle: "Truco · Mago", notes: "V, S",
    });
  });
  it("daño: dados del conjuro y, en los trucos, según el nivel del personaje", () => {
    const fire = summary([block({ cantrips: [named("spell:fire bolt|xphb")], prepared: [ref("spell:burning hands|xphb")] })]);
    const at = (level: number) => run(fire, [], [fist], [], entries, level).items;
    expect(spellItem(at(1), "Descarga de fuego")?.damage).toBe("1d10");
    expect(spellItem(at(5), "Descarga de fuego")?.damage).toBe("2d10");
    expect(spellItem(at(5), "Manos ardientes")?.damage).toBe("3d6");
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
  it("los de especie y dotes, con su origen en el subtítulo y sin tirada si no la tienen", () => {
    expect(spellItem(items, "Paso brumoso")).toMatchObject({ subtitle: "Nivel 2 · Especie: Tiefling", notes: "V, S", hit: null });
  });
  it("notas: componentes, concentración y ritual; subtítulo: nivel y origen", () => {
    const fire = run(summary([block({ cantrips: [named("spell:fire bolt|xphb")] })])).items;
    expect(spellItem(fire, "Descarga de fuego")).toMatchObject({ notes: "V, S", subtitle: "Truco · Mago" });
    expect(spellItem(items, "Detectar magia")).toMatchObject({ notes: "V, S, M · Concentración · Ritual", subtitle: "Nivel 1 · Mago" });
  });
  it("conjuro de dote con característica: ataque, daño y a la tabla de ataques", () => {
    const spells = {
      ...summary([], [{ spell: named("spell:shocking grasp|xphb", "Agarre electrizante"), origin: "Dote: Iniciado en la magia (mago)", innate: true as const, ability: "int" as const }]),
      casting: { proficiencyBonus: 2, mods: { str: 0, dex: 0, con: 0, int: 3, wis: 0, cha: 0 } },
    };
    const grasp = spellItem(run(spells).items, "Agarre electrizante");
    expect(grasp).toMatchObject({ hit: "+5", damage: "1d8", subtitle: "Truco · Dote: Iniciado en la magia (mago)" });
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
    expect(spellItem(out, "Escudo")?.subtitle).toBe("Nivel 1 · Mente aberrante");
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
  it("especie con varios contadores: un ítem por uso, en el grupo de su activación", () => {
    const orcKey = `${B}:species:orc|xphb`;
    const base = { max: 1, used: 0 };
    const orcUses: FeatureUse[] = [
      { ...base, key: `${orcKey}#adrenaline-rush`, name: "Oleada de adrenalina", recovery: { long: "all", short: "all" }, owner: orcKey, activation: "bonus" },
      { ...base, key: orcKey, name: "Aguante incansable", recovery: { long: "all", short: "none" }, owner: orcKey },
    ];
    const orcGroups: FeatureGroup[] = [{ title: "Orco", source: "species", ref: ref("species:orc|xphb"), features: [] }];
    const out = run(summary([]), orcGroups, [], orcUses).items.filter((i) => i.kind === "feature");
    expect(out).toMatchObject([
      { name: "Oleada de adrenalina", group: "bonus", special: false, source: "Orco" },
      { name: "Aguante incansable", group: "other", special: true, source: "Orco" },
    ]);
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
    deriveActions({ attacks: [], spells: wizard, features: [], featureUses: [], basics: [], entries: m, level: 1 }).items
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
