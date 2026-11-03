import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { inlineTags } from "@/lib/rules/import/toBbcode";
import es from "@/lib/rules/i18n/es.json";
import {
  normalizeAll, normalizeBackground, normalizeDefenses, normalizeFeat, normalizeItem, normalizeLineage, normalizeOptionalFeature, expandVersions, resolveCopy, textChoiceFeatures, toIdentifier, unreachableFeatures,
  type NormalizedEntry, type RawFiles,
} from "@/lib/rules/import/normalize";
import type {
  ActionData, BackgroundData, ClassData, FeatData, FeatureData, ItemData, LineageData, NameTableData, OptionalFeatureData, SpeciesData, SpellData,
  SubclassData,
} from "@/lib/rules/types";

const fixture = (f: string) =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "../fixtures/5etools", f), "utf8"));

const files: RawFiles = {
  races: fixture("races.json"),
  backgrounds: fixture("backgrounds.json"),
  feats: fixture("feats.json"),
  items: fixture("items.json"),
  itemsBase: fixture("items-base.json"),
  spells: [fixture("spells.json")],
  spellSources: fixture("spell-sources.json"),
  classes: [fixture("class-barbarian.json")],
};

const { entries, errors } = normalizeAll(files, "XPHB");
const find = (kind: string, key: string): NormalizedEntry | undefined =>
  entries.find((e) => e.kind === kind && e.key === key);

describe("toIdentifier", () => {
  test("minúsculas, guiones y sin signos", () => {
    expect(toIdentifier("Fireball")).toBe("fireball");
    expect(toIdentifier("Explorer's Pack")).toBe("explorers-pack");
    expect(toIdentifier("Magic Initiate; Cleric")).toBe("magic-initiate-cleric");
  });
});

describe("especie con legados (Elfo)", () => {
  test("una especie con elección de habilidad", () => {
    const elf = find("species", "species:elf|xphb");
    expect(elf).toBeDefined();
    const data = elf!.data as SpeciesData;
    expect(data.hasLineages).toBe(true);
    expect(data.darkvision).toBe(60);
    expect(data.skills.choose).toEqual({ count: 1, from: ["insight", "perception", "survival"] });
    expect(elf!.identifier).toBe("elf");
    expect(elf!.srd52).toBe(true);
    expect(elf!.description).toContain("Trance");
  });
  test("tres legados con su especie como padre", () => {
    const lineages = entries.filter((e) => e.kind === "lineage");
    expect(lineages.map((l) => l.key).sort()).toEqual(["lineage:drow|xphb", "lineage:high elf|xphb", "lineage:wood elf|xphb"]);
    expect(lineages.every((l) => l.parent?.key === "species:elf|xphb")).toBe(true);
    const drow = find("lineage", "lineage:drow|xphb")!;
    const data = drow.data as LineageData;
    expect(drow.name).toBe("Drow");
    expect(data.darkvision).toBe(120);
    expect(data.spells.map((s) => [s.level, s.ref.key])).toEqual([
      [1, "spell:dancing lights|xphb"], [3, "spell:faerie fire|xphb"], [5, "spell:darkness|xphb"],
    ]);
    expect(drow.description).toContain("120");
    expect(data.speed).toBeUndefined();
    expect((find("lineage", "lineage:high elf|xphb")!.data as LineageData).darkvision).toBeUndefined();
    expect((find("lineage", "lineage:wood elf|xphb")!.data as LineageData).speed).toBe(35);
  });
});

test("trasfondo (Acólito)", () => {
  const data = find("background", "background:acolyte|xphb")!.data as BackgroundData;
  expect(data.abilities).toEqual(["int", "wis", "cha"]);
  expect(data.feat).toEqual({ book: "__BOOK__", key: "feat:magic initiate; cleric|xphb" });
  expect(data.skills).toEqual(["insight", "religion"]);
  expect(data.tools).toEqual(["calligrapher's supplies"]);
  expect(data.equipment.B).toEqual([{ value: 5000 }]);
  expect(data.equipment.A[0]).toEqual({ ref: { book: "__BOOK__", key: "item:book|xphb" }, displayName: "Book (Prayers)" });
});

test("dote con versiones (Magic Initiate)", () => {
  expect(find("feat", "feat:magic initiate|xphb")).toBeDefined();
  const cleric = find("feat", "feat:magic initiate; cleric|xphb");
  expect(cleric).toBeDefined();
  expect(cleric!.data).toMatchObject({ category: "origin", categoryCode: "O", repeatable: true });
  expect(cleric!.description).not.toContain("Druid");
});

test("dotes con conjuros: los fijos en `spells` y `grantsSpells` también si solo se eligen", () => {
  const fey = find("feat", "feat:fey-touched|xphb")!.data as FeatData;
  expect(fey.spells).toEqual([{ level: 1, ref: { book: "__BOOK__", key: "spell:misty step|xphb" } }]);
  expect(fey.grantsSpells).toBe(true);
  const initiate = find("feat", "feat:magic initiate; cleric|xphb")!.data as FeatData;
  expect(initiate.spells).toBeUndefined();
  expect(initiate.grantsSpells).toBe(true);
  // Conjuros elegidos: filtros de `choose` por nivel de personaje y la característica elegible
  expect(initiate.spellChoices).toEqual([
    { level: 1, count: 2, filter: { level: 0, classes: ["cleric"] } },
    { level: 1, count: 1, filter: { level: 1, classes: ["cleric"] } },
  ]);
  expect(initiate.spellAbility).toEqual(["int", "wis", "cha"]);
  expect(fey.spellChoices).toEqual([{ level: 1, count: 1, filter: { level: 1, schools: ["E", "D"] } }]);
  expect(fey.spellAbility).toBeUndefined();
  const ritual = normalizeFeat({
    name: "Ritual Caster", source: "XPHB", category: "G",
    additionalSpells: [{ prepared: {
      1: [{ choose: "level=1|components & miscellaneous=ritual", count: 2 }],
      5: [{ choose: "level=1|components & miscellaneous=ritual", count: 1 }],
    } }],
  }).data as FeatData;
  expect(ritual.spellChoices).toEqual([
    { level: 1, count: 2, filter: { level: 1, ritual: true } }, { level: 5, count: 1, filter: { level: 1, ritual: true } },
  ]);
  // Con varias listas alternativas que piden lo mismo (la dote base de Iniciado en la magia), la lista se elige
  const base = find("feat", "feat:magic initiate|xphb")!.data as FeatData;
  const LISTS = ["cleric", "druid", "wizard"];
  expect(base.spellChoices).toEqual([
    { level: 1, count: 2, filter: { level: 0 }, lists: LISTS }, { level: 1, count: 1, filter: { level: 1 }, lists: LISTS },
  ]);
  expect(base.spellChoices!.map((c) => c.lists)).toEqual([LISTS, LISTS]);
  expect(base.spellAbility).toEqual(["int", "wis", "cha"]);
  // Alternativas que piden cosas distintas: sin elección
  const mixed = normalizeFeat({
    name: "Mixed", source: "XPHB", category: "G",
    additionalSpells: [
      { name: "A", known: { _: [{ choose: "level=0|class=Cleric", count: 2 }] } },
      { name: "B", known: { _: [{ choose: "level=0|class=Druid", count: 1 }] } },
    ],
  }).data as FeatData;
  expect(mixed.spellChoices).toBeUndefined();
  const alert = normalizeFeat({ name: "Alert", source: "XPHB", category: "O" }).data;
  expect(alert).not.toHaveProperty("grantsSpells");
  expect(alert).not.toHaveProperty("spells");
});

test("clase con conjuros siempre preparados (Paladín)", () => {
  const { entries: es } = normalizeAll({ classes: [fixture("class-paladin.json")] }, "XPHB");
  const paladin = es.find((e) => e.key === "class:paladin|xphb")!.data as ClassData;
  expect(paladin.spells!.map((s) => [s.level, s.ref.key])).toEqual([[2, "spell:divine smite|xphb"], [5, "spell:find steed|xphb"]]);
  expect((find("class", "class:barbarian|xphb")!.data as ClassData).spells).toEqual([]);
});

describe("clase (Bárbaro)", () => {
  const data = find("class", "class:barbarian|xphb")!.data as ClassData;
  test("datos básicos", () => {
    expect(data.hitDie).toBe(12);
    expect(data.saves).toEqual(["str", "con"]);
    expect(data.primaryAbility).toEqual(["str"]);
    expect(data.skills.count).toBe(2);
    expect(data.skills.from).toHaveLength(6);
    expect(data.subclassLevel).toBe(3);
    expect(data.asiLevels).toEqual([4, 8, 12, 16]);
    expect(data.spellcasting).toBeNull();
  });
  test("sin fluff, la descripción es un resumen en español", () => {
    const description = find("class", "class:barbarian|xphb")!.description;
    expect(description).toContain("[b]Dado de golpe:[/b] d12");
    expect(description).toContain("[b]Característica principal:[/b] Fuerza");
    expect(description).toContain("[b]Salvaciones:[/b] Fuerza, Constitución");
    expect(description).toContain("[b]Habilidades:[/b] elige 2 entre Trato con animales, Atletismo");
    expect(description).toContain("[b]Armaduras:[/b] Armadura ligera, Armadura intermedia, Escudos");
    expect(description).toContain("[b]Rasgos de nivel 1:[/b] Rage, Unarmored Defense, Weapon Mastery");
  });
  test("con fluff, la descripción es su texto (sin el título de la sección)", () => {
    const withFluff = normalizeAll({
      ...files,
      classFluff: [{
        classFluff: [{
          name: "Barbarian", source: "XPHB",
          entries: [{ type: "section", name: "Barbarian", entries: ["Barbarians are {@b mighty} warriors."] }],
        }],
      }],
    }, "XPHB").entries.find((e) => e.key === "class:barbarian|xphb")!;
    expect(withFluff.description).toBe("Barbarians are [b]mighty[/b] warriors.");
  });
  test("rasgos y equipo", () => {
    expect(data.features[0]).toEqual({ ref: { book: "__BOOK__", key: "classFeature:rage|barbarian|xphb|1" }, level: 1 });
    expect(data.equipment.A[1]).toEqual({ ref: { book: "__BOOK__", key: "item:handaxe|xphb" }, quantity: 4 });
  });
  test("rasgos de clase con la clase como padre", () => {
    const rage = find("classFeature", "classFeature:rage|barbarian|xphb|1")!;
    expect(rage.parent).toEqual({ key: "class:barbarian|xphb" });
    expect(rage.data).toEqual({ level: 1, className: "Barbarian", activation: "bonus" });
    expect(entries.filter((e) => e.kind === "classFeature")).toHaveLength(3);
  });
  test("subclase", () => {
    const sub = find("subclass", "subclass:path of the berserker|barbarian|xphb")!;
    expect(sub.parent).toEqual({ key: "class:barbarian|xphb" });
    const sd = sub.data as SubclassData;
    expect(sd.features[0]).toEqual({
      ref: { book: "__BOOK__", key: "subclassFeature:path of the berserker|barbarian|xphb|berserker|xphb|3" }, level: 3,
    });
  });
});

test("rasgo de subclase y conjuros por nivel de clase", () => {
  const { entries: es, errors: errs } = normalizeAll({
    classes: [{
      class: [],
      subclass: [{
        name: "Oath of Devotion", shortName: "Devotion", source: "XPHB", className: "Paladin", classSource: "XPHB",
        subclassFeatures: ["Oath of Devotion|Paladin|XPHB|Devotion|XPHB|3"],
        additionalSpells: [{ prepared: { 3: ["shield of faith|xphb"], 17: ["commune|xphb"] } }],
      }],
      subclassFeature: [{
        name: "Oath of Devotion", source: "XPHB", className: "Paladin", classSource: "XPHB",
        subclassShortName: "Devotion", subclassSource: "XPHB", level: 3, entries: ["Texto"],
      }],
    }],
  }, "XPHB");
  expect(errs).toEqual([]);
  const sub = es.find((e) => e.kind === "subclass")!;
  expect((sub.data as SubclassData).spells).toEqual([
    { level: 3, ref: { book: "__BOOK__", key: "spell:shield of faith|xphb" } },
    { level: 17, ref: { book: "__BOOK__", key: "spell:commune|xphb" } },
  ]);
  const feat = es.find((e) => e.kind === "subclassFeature")!;
  expect(feat.key).toBe("subclassFeature:oath of devotion|paladin|xphb|devotion|xphb|3");
  expect(feat.parent).toEqual({ key: "subclass:oath of devotion|paladin|xphb" });
  expect(feat.data).toEqual({ level: 3, className: "Paladin", subclassName: "Oath of Devotion" });
});

test("conjuro (Fireball)", () => {
  const fb = find("spell", "spell:fireball|xphb")!;
  const data = fb.data as SpellData;
  expect(data.level).toBe(3);
  expect(data.school).toBe("V");
  expect(data.classes).toEqual(expect.arrayContaining(["sorcerer", "wizard"]));
  expect(data.time).toBe("1 acción");
  expect(data.range).toBe("45 metros (150 pies)");
  expect(data.components).toBe("V, S, M (a ball of bat guano and sulfur)");
  expect(data.duration).toBe("Instantáneo");
  expect(data.concentration).toBe(false);
  expect(data.tags).toEqual(expect.arrayContaining(["Daño de fuego", "Salvación de Destreza", "Área: esfera"]));
  expect(data.higherLevels).toMatch(/^The damage increases by .*1d6.* above 3/);
  expect(fb.description).toContain("Using a Higher-Level Spell Slot");
});

test("conjuro: clases desde sources.json y subclases que lo conceden", () => {
  const spell = { ...fixture("spells.json").spell[0], name: "Shield of Faith", level: 1 };
  const life = { name: "Life Domain", shortName: "Life", source: "XPHB", className: "Cleric", classSource: "XPHB",
    additionalSpells: [{ prepared: { 3: ["shield of faith|xphb"] } }], subclassFeatures: [] };
  const r = normalizeAll({
    spells: [{ spell: [spell] }],
    spellSources: { XPHB: { "Shield of Faith": { class: [{ name: "Cleric", source: "XPHB" }, { name: "Paladin", source: "XPHB" },
      { name: "Cleric", source: "PHB" }] } } },
    classes: [{ subclass: [life] }],
  }, "XPHB");
  expect(r.errors).toEqual([]);
  const data = r.entries.find((e) => e.key === "spell:shield of faith|xphb")!.data as SpellData;
  expect(data.classes).toEqual(["cleric", "paladin", "subclass:life-domain"]);
});

describe("modos de lanzamiento", () => {
  const classes = ["cleric", "sorcerer", "warlock", "ranger"].map((c) => fixture(`class-${c}.json`));
  const wizard = { ...classes[0].class[0], name: "Wizard", spellcastingAbility: "int", casterProgression: "full" };
  const { entries: es } = normalizeAll({ classes: [...classes, { class: [wizard] }] }, "XPHB");
  const casting = (key: string) => (es.find((e) => e.key === key)!.data as ClassData).spellcasting;

  test("Mago con libro, Clérigo con lista, Hechicero al subir de nivel", () => {
    expect(casting("class:wizard|xphb")).toEqual({ ability: "int", progression: "full", mode: "spellbook" });
    expect(casting("class:cleric|xphb")?.mode).toBe("list");
    expect(casting("class:sorcerer|xphb")?.mode).toBe("levelUp");
    expect(casting("class:warlock|xphb")).toEqual({ ability: "cha", progression: "pact", mode: "levelUp" });
    expect(casting("class:ranger|xphb")).toEqual({ ability: "wis", progression: "half", mode: "levelUp" });
  });

  test("subclase lanzadora de tercio (Caballero arcano)", () => {
    const ek = { name: "Eldritch Knight", shortName: "Eldritch Knight", source: "XPHB", className: "Fighter",
      classSource: "XPHB", spellcastingAbility: "int", casterProgression: "1/3", subclassFeatures: [],
      cantripProgression: [0, 0, 2, ...Array(17).fill(3)], preparedSpellsProgression: [0, 0, 3, ...Array(17).fill(4)] };
    const r = normalizeAll({ classes: [{ subclass: [ek] }] }, "XPHB");
    expect(r.errors).toEqual([]);
    const data = r.entries[0].data as SubclassData;
    expect(data.spellcasting).toEqual({ ability: "int", progression: "third", mode: "levelUp" });
    expect(data.progressions.cantrips?.slice(0, 3)).toEqual([0, 0, 2]);
    expect(data.progressions.prepared?.slice(0, 3)).toEqual([0, 0, 3]);
  });
});

test("la clave de la entrada coincide con el destino de [ref] del BBCode", () => {
  expect(inlineTags("{@spell Fireball|XPHB}")).toBe(`[ref=${find("spell", "spell:fireball|xphb")!.key}]Fireball[/ref]`);
});

test("las elecciones de conjuros (choose) no se convierten en referencias", () => {
  // Fragmento escrito a mano con la forma del College of Lore (prepared.6) y del Eldritch Knight (expanded con `all`)
  const { entries: es, errors: errs } = normalizeAll({
    classes: [{
      subclass: [{
        name: "College of Lore", shortName: "Lore", source: "XPHB", className: "Bard", classSource: "XPHB",
        subclassFeatures: ["College of Lore|Bard|XPHB|Lore|XPHB|3"],
        additionalSpells: [{
          prepared: { 3: ["counterspell|xphb"], 6: [{ choose: "level=0;1;2;3|class=Cleric;Druid;Wizard", count: 2 }] },
          known: { _: [{ choose: "level=0|class=Wizard" }] },
          expanded: { 7: [{ all: "level=2|class=Wizard" }] },
        }],
      }],
    }],
  }, "XPHB");
  expect(errs).toEqual([]);
  expect((es[0].data as SubclassData).spells).toEqual([
    { level: 3, ref: { book: "__BOOK__", key: "spell:counterspell|xphb" } },
  ]);
});

test("bloques de conjuros alternativos con nombre (Círculo de la Tierra): no se conceden, quedan como opciones", () => {
  const { entries: es, errors: errs } = normalizeAll({
    classes: [{
      subclass: [{
        name: "Circle of the Land", shortName: "Land", source: "XPHB", className: "Druid", classSource: "XPHB",
        subclassFeatures: [],
        additionalSpells: [
          { name: "Arid Land", prepared: { 3: ["blur|xphb", "fire bolt|xphb"], 5: ["fireball|xphb"] } },
          { name: "Polar Land", prepared: { 3: ["fog cloud|xphb"] } },
        ],
      }],
    }],
  }, "XPHB");
  expect(errs).toEqual([]);
  const data = es[0].data as SubclassData;
  expect(data.spells).toEqual([]);
  const r = (k: string) => ({ book: "__BOOK__", key: `spell:${k}|xphb` });
  expect(data.spellOptions).toEqual([
    { name: "Arid Land", spells: [{ level: 3, ref: r("blur") }, { level: 3, ref: r("fire bolt") }, { level: 5, ref: r("fireball") }] },
    { name: "Polar Land", spells: [{ level: 3, ref: r("fog cloud") }] },
  ]);
});

test("Druida: Encontrar familiar no es un conjuro siempre preparado (lo lanza con Forma salvaje)", () => {
  const druid = {
    name: "Druid", source: "XPHB", hd: { number: 1, faces: 8 }, proficiency: ["int", "wis"],
    primaryAbility: [{ wis: true }], spellcastingAbility: "wis", casterProgression: "full",
    startingProficiencies: { skills: [{ choose: { from: ["arcana"], count: 1 } }] },
    startingEquipment: { defaultData: [{ A: [{ value: 100 }] }] },
    additionalSpells: [{ prepared: { 1: ["speak with animals|xphb"], 2: ["find familiar|xphb"] } }],
    classFeatures: [],
  };
  const { entries: es, errors: errs } = normalizeAll({ classes: [{ class: [druid] }] }, "XPHB");
  expect(errs).toEqual([]);
  expect((es[0].data as ClassData).spells).toEqual([{ level: 1, ref: { book: "__BOOK__", key: "spell:speak with animals|xphb" } }]);
});

test("equipo con más de dos opciones (Guerrero) y clase lanzadora", () => {
  const fighter = {
    name: "Fighter", source: "XPHB", hd: { number: 1, faces: 10 }, proficiency: ["str", "con"],
    primaryAbility: [{ str: true }, { dex: true }],
    startingProficiencies: { skills: [{ choose: { from: ["acrobatics", "athletics"], count: 2 } }] },
    startingEquipment: { defaultData: [{
      A: [{ item: "chain mail|xphb" }, { value: 400 }],
      B: [{ item: "studded leather armor|xphb" }, { value: 1100 }],
      C: [{ value: 15500 }],
    }] },
    classFeatures: [{ classFeature: "Fighter Subclass|Fighter|XPHB|3", gainSubclassFeature: true }],
  };
  const wizard = {
    ...fighter, name: "Wizard", hd: { number: 1, faces: 6 }, primaryAbility: [{ int: true }],
    spellcastingAbility: "int", casterProgression: "full",
    classTableGroups: [{ colLabels: ["Cantrips"], rows: [["3"]] }, { title: "Spell Slots per Spell Level",
      colLabels: ["1st", "2nd"], rowsSpellProgression: [[2, 0], [3, 0], [4, 2]] }],
  };
  const paladin = { ...wizard, name: "Paladin", spellcastingAbility: "cha", casterProgression: "artificer" };
  const { entries: es, errors: errs } = normalizeAll({ classes: [{ class: [fighter, wizard, paladin] }] }, "XPHB");
  expect(errs).toEqual([]);
  const data = (key: string) => es.find((e) => e.key === key)!.data as ClassData;
  expect(Object.keys(data("class:fighter|xphb").equipment)).toEqual(["A", "B", "C"]);
  expect(data("class:fighter|xphb").equipment.C).toEqual([{ value: 15500 }]);
  expect(data("class:fighter|xphb").primaryAbility).toEqual(["str", "dex"]);
  expect(data("class:fighter|xphb").spellcasting).toBeNull();
  expect(data("class:wizard|xphb").spellcasting).toEqual({ ability: "int", progression: "full", mode: "spellbook" });
  expect(data("class:paladin|xphb").spellcasting?.progression).toBe("half");
});

test("objetos (Greataxe y Explorer's Pack)", () => {
  const axe = find("item", "item:greataxe|xphb")!.data as ItemData;
  expect(axe.weapon?.damage).toBe("1d12");
  expect(axe.weapon?.mastery).toBe("cleave");
  expect(axe.weapon?.properties).toEqual(["H", "2H"]);
  expect(axe.value).toBe(3000);
  const pack = find("item", "item:explorer's pack|xphb")!;
  expect(pack.identifier).toBe("explorers-pack");
  expect((pack.data as ItemData).contents?.[2]).toEqual({ ref: { book: "__BOOK__", key: "item:oil|xphb" }, quantity: 2 });
});

test("una entrada inválida va a errors y no a entries", () => {
  const broken = { ...fixture("spells.json").spell[0], name: "Broken", level: 12 };
  const r = normalizeAll({ spells: [{ spell: [broken] }] }, "XPHB");
  expect(r.entries).toEqual([]);
  expect(r.errors).toHaveLength(1);
  expect(r.errors[0].key).toBe("spell:broken|xphb");
  expect(r.errors[0].errors.join()).toContain("level");
});

test("ignora entradas de otras fuentes", () => {
  const other = { ...fixture("spells.json").spell[0], source: "PHB" };
  expect(normalizeAll({ spells: [{ spell: [other] }] }, "XPHB").entries).toEqual([]);
});

test("los itemGroup se importan como objetos", () => {
  const group = { name: "Holy Symbol", source: "XPHB", srd52: true, type: "SCF|XPHB", scfType: "holy", items: ["Amulet|XPHB"] };
  const r = normalizeAll({ items: { itemGroup: [group] } }, "XPHB");
  expect(r.errors).toEqual([]);
  expect(r.entries).toHaveLength(1);
  expect(r.entries[0]).toMatchObject({ kind: "item", key: "item:holy symbol|xphb", srd52: true });
  expect((r.entries[0].data as ItemData).type).toBe("SCF");
});

describe("herencias", () => {
  test("_copy copia la base y aplica _mod", () => {
    const all = [
      { name: "Base", source: "X", srd52: true, entries: [{ name: "A", entries: ["a"] }, { name: "B", entries: ["b"] }] },
      { name: "Copia", source: "X", _copy: { name: "Base", source: "X", _mod: { entries: { mode: "removeArr", names: "A" } } } },
    ];
    const r = resolveCopy(all[1], all) as Record<string, unknown>;
    expect(r.name).toBe("Copia");
    expect(r.entries).toEqual([{ name: "B", entries: ["b"] }]);
    expect(r.srd52).toBeUndefined();
    expect(r._copy).toBeUndefined();
  });
  test("_versions abstractas con variables", () => {
    const base = {
      name: "Dragonborn", source: "XPHB", entries: [{ name: "Breath", entries: ["x"] }],
      _versions: [{
        _abstract: { name: "Dragonborn ({{color}})", source: "XPHB",
          _mod: { entries: { mode: "replaceArr", replace: "Breath", items: { name: "Breath", entries: ["{{damageType}} damage"] } } } },
        _implementations: [{ _variables: { color: "Black", damageType: "Acid" } }],
      }],
    };
    const [v] = expandVersions(base);
    expect(v.name).toBe("Dragonborn (Black)");
    expect(v.entries).toEqual([{ name: "Breath", entries: ["Acid damage"] }]);
    expect(v._versions).toBeUndefined();
  });
  test("appendArr añade al final", () => {
    const [v] = expandVersions({ name: "S", source: "X", entries: ["a"],
      _versions: [{ name: "S; V", source: "X", _mod: { entries: { mode: "appendArr", items: ["b"] } } }] });
    expect(v.entries).toEqual(["a", "b"]);
  });
});

test("sin errores en los fragmentos reales", () => {
  expect(errors).toEqual([]);
});

describe("tipos de equipo a elegir", () => {
  test("los códigos de 5etools pasan a texto en español", () => {
    const bg = normalizeBackground({
      name: "Guard", source: "XPHB",
      startingEquipment: [{
        A: [{ equipmentType: "setGaming" }, { equipmentType: "toolArtisan" }, { equipmentType: "codigoRaro" }],
        B: [{ equipmentTypes: ["instrumentMusical", "setGaming"] }],
      }],
    });
    const data = bg.data as BackgroundData;
    expect(data.equipment.A.map((p) => p.displayName)).toEqual([
      "Un juego (a elegir)", "Unas herramientas de artesano (a elegir)", "codigoRaro",
    ]);
    expect(data.equipment.B[0].displayName).toBe("Un instrumento musical (a elegir) o un juego (a elegir)");
  });
});

describe("objetos a elegir (choose)", () => {
  const packs = (equipment: unknown[]) => (normalizeBackground({
    name: "X", source: "XPHB", startingEquipment: [{ A: equipment }],
  }).data as BackgroundData).equipment.A;

  test("juego, instrumento y herramientas llevan sus tipos", () => {
    const [a] = packs([{ equipmentType: "setGaming" }]);
    expect(a).toEqual({ choose: { kinds: ["gaming"], label: "Un juego (a elegir)" }, displayName: "Un juego (a elegir)" });
    const [b] = packs([{ equipmentTypes: ["instrumentMusical", "toolArtisan"] }]);
    expect(b.choose?.kinds).toEqual(["instrument", "artisan"]);
    expect(b.choose?.label).toBe(b.displayName);
    expect(b.displayName).toBe("Un instrumento musical (a elegir) o unas herramientas de artesano (a elegir)");
  });
  test("armas por categoría", () => {
    const kinds = (code: string) => packs([{ equipmentType: code }])[0].choose?.kinds;
    expect(kinds("weaponSimple")).toEqual(["simple"]);
    expect(kinds("weaponSimpleMelee")).toEqual(["simpleMelee"]);
    expect(kinds("weaponMartial")).toEqual(["martial"]);
    expect(kinds("weaponMartialMelee")).toEqual(["martialMelee"]);
    expect(kinds("anyGamingSet")).toEqual(["gaming"]);
    expect(kinds("anyArtisansTool")).toEqual(["artisan"]);
    expect(kinds("anyMusicalInstrument")).toEqual(["instrument"]);
  });
  test("canalizadores, códigos desconocidos y listas mixtas quedan como texto", () => {
    const [f] = packs([{ equipmentType: "focusSpellcastingArcane" }]);
    expect(f).toEqual({ displayName: "Un canalizador arcano (a elegir)" });
    const [m] = packs([{ equipmentTypes: ["focusSpellcastingArcane", "toolArtisan"] }]);
    expect(m.choose).toBeUndefined();
    expect(m.displayName).toBeTruthy();
  });
});

test("competencias de armas con {@filter}: queda el texto visible", () => {
  const rogue = {
    name: "Rogue", source: "XPHB", hd: { number: 1, faces: 8 }, proficiency: ["dex", "int"],
    primaryAbility: [{ dex: true }],
    startingEquipment: { defaultData: [{ A: [{ value: 100 }] }] },
    startingProficiencies: { skills: [{ choose: { from: ["stealth"], count: 1 } }], weapons: [
      "simple",
      "Martial weapons that have the {@filter Finesse or Light|items|type=martial weapon|property=finesse;light} property",
    ] },
  };
  const { entries: es, errors: errs } = normalizeAll({ classes: [{ class: [rogue] }] }, "XPHB");
  expect(errs).toEqual([]);
  expect((es.find((e) => e.key === "class:rogue|xphb")!.data as ClassData).weapons)
    .toEqual(["simple", "Martial weapons that have the Finesse or Light property"]);
});

describe("progresiones, tabla, multiclase y rasgos opcionales", () => {
  const r = normalizeAll({
    classes: ["class-barbarian.json", "class-sorcerer.json", "class-fighter.json", "class-cleric.json"].map(fixture),
    optionalFeatures: fixture("optionalfeatures.json"),
  }, "XPHB");
  const get = (key: string) => r.entries.find((e) => e.key === key)!;
  const cls = (name: string) => get(`class:${name}|xphb`).data as ClassData;

  test("sin errores", () => {
    expect(r.errors).toEqual([]);
  });
  test("Hechicero: metamagia acumulada por nivel y conjuros", () => {
    const p = cls("sorcerer").progressions;
    expect(p.optionalFeatures[0]).toEqual({ name: "Metamagic", featureType: ["MM"], levels: { 2: 2, 10: 4, 17: 6 } });
    expect(p.feats).toEqual([{ category: ["EB"], levels: { 19: 1 } }]);
    expect(p.cantrips).toHaveLength(20);
    expect(p.cantrips?.[0]).toBe(4);
    expect(p.prepared?.slice(0, 3)).toEqual([2, 4, 6]);
    expect(p.spellbook).toBeNull();
    expect(p.weaponMastery).toBeNull();
    expect(cls("sorcerer").multiclass.proficiencies).toEqual({ armor: [], weapons: [], tools: [], skills: null });
  });
  test("Bárbaro: maestrías, requisito de multiclase y tabla", () => {
    const data = cls("barbarian");
    expect(data.progressions.weaponMastery).toEqual({ 1: 2, 4: 3, 10: 4 });
    expect(data.multiclass.requirements).toEqual({ abilities: ["str"], any: false });
    expect(data.multiclass.proficiencies).toEqual({ armor: ["shield"], weapons: ["martial"], tools: [], skills: null });
    expect(data.table.columns.map((c) => c.label)).toEqual(["Furias", "Daño de furia", "Maestría con armas"]);
    expect(data.table.columns.every((c) => c.values.length === 20)).toBe(true);
    expect(data.table.columns[0].values.slice(0, 3)).toEqual(["2", "2", "3"]);
    expect(data.table.columns[1].values[0]).toBe("+2");
    expect(data.subclassTitle).toBe("Senda primitiva");
  });
  test("Guerrero: estilo de combate y requisito alternativo", () => {
    const data = cls("fighter");
    expect(data.progressions.feats[0].category).toContain("FS");
    expect(data.progressions.feats[0].levels).toEqual({ 1: 1 });
    expect(data.progressions.weaponMastery).toEqual({ 1: 3, 4: 4, 10: 5, 16: 6 });
    expect(data.multiclass.requirements).toEqual({ abilities: ["str", "dex"], any: true });
  });
  test("Clérigo: tabla con espacios de conjuro y ceros como «—»", () => {
    const labels = cls("cleric").table.columns.map((c) => c.label);
    expect(labels.slice(0, 4)).toEqual(["Canalizar divinidad", "Trucos", "Conjuros preparados", "Espacios de nivel 1"]);
    expect(labels).toHaveLength(12);
    const channel = cls("cleric").table.columns[0].values;
    expect(channel[0]).toBe("—");
    expect(channel[1]).toBe("2");
  });
  test("rasgo con opciones (Orden divina) y mejora de característica", () => {
    const order = get("classFeature:divine order|cleric|xphb|1").data as FeatureData;
    expect(order.options).toEqual([
      { book: "__BOOK__", key: "classFeature:protector|cleric|xphb|1" },
      { book: "__BOOK__", key: "classFeature:thaumaturge|cleric|xphb|1" },
    ]);
    expect(r.entries.some((e) => e.key === order.options![0].key)).toBe(true);
    expect((get("classFeature:ability score improvement|fighter|xphb|4").data as FeatureData).asi).toBe(true);
    const style = get("classFeature:fighting style|fighter|xphb|1").data as FeatureData;
    expect(style.asi).toBeUndefined();
    expect(style.options).toBeUndefined();
  });
  test("rasgos opcionales: tipo y prerrequisitos", () => {
    const step = get("optionalFeature:ascendant step|xphb");
    expect(step.kind).toBe("optionalFeature");
    expect(step.parent).toBeNull();
    expect((step.data as OptionalFeatureData).prerequisite?.level).toBe(5);
    expect(step.data).toEqual({
      featureType: ["EI"], prerequisite: { level: 5 },
      // Conjuro que da la invocación, desde que se tiene
      spells: [{ level: 1, ref: { book: "__BOOK__", key: "spell:levitate|xphb" } }],
    });
    expect(get("optionalFeature:eldritch smite|xphb").data).toEqual({
      featureType: ["EI"], prerequisite: { level: 5, pact: "optionalFeature:pact of the blade|xphb" },
    });
    expect(get("optionalFeature:careful spell|xphb").data).toEqual({ featureType: ["MM"] });
    expect(r.entries.filter((e) => e.kind === "optionalFeature")).toHaveLength(4);
  });
  test("Pacto del tomo: 3 trucos de cualquier lista y 2 rituales de nivel 1 a elegir", () => {
    const tome = normalizeOptionalFeature({
      name: "Pact of the Tome", source: "XPHB", featureType: ["EI"],
      additionalSpells: [{
        ability: "cha",
        known: { _: [{ choose: "level=0", count: 3 }] },
        prepared: { _: [{ choose: "level=1|components & miscellaneous=ritual", count: 2 }] },
      }],
    }).data as OptionalFeatureData;
    expect(tome).toEqual({
      featureType: ["EI"],
      spellChoices: [{ level: 1, count: 3, filter: { level: 0 } }, { level: 1, count: 2, filter: { level: 1, ritual: true } }],
    });
  });
  test("progresiones de subclase: maniobras del Maestro de batalla y estilo del Campeón", () => {
    const battleMaster = get("subclass:battle master|fighter|xphb").data as SubclassData;
    expect(battleMaster.progressions).toEqual({
      feats: [],
      optionalFeatures: [{ name: "Maneuvers", featureType: ["MV:B"], levels: { 3: 3, 7: 5, 10: 7, 15: 9 } }],
    });
    const champion = get("subclass:champion|fighter|xphb").data as SubclassData;
    expect(champion.progressions).toEqual({ feats: [{ category: ["FS"], levels: { 7: 1 } }], optionalFeatures: [] });
  });
  test("rasgos anidados en la cabecera de subclase (Maestro de batalla)", () => {
    const features = (get("subclass:battle master|fighter|xphb").data as SubclassData).features;
    const bm = (name: string, level: number) => `subclassFeature:${name}|fighter|xphb|battle master|xphb|${level}`;
    expect(features.map((f) => [f.ref.key, f.level])).toEqual([
      [bm("battle master", 3), 3],
      [bm("combat superiority", 3), 3],
      [bm("student of war", 3), 3],
      [bm("maneuver options", 3), 3],
      [bm("know your enemy", 7), 7],
      [bm("improved combat superiority", 10), 10],
      [bm("relentless", 15), 15],
      [bm("ultimate combat superiority", 18), 18],
    ]);
    // Los anidados existen como entradas
    for (const f of features.slice(1, 4)) expect(r.entries.some((e) => e.key === f.ref.key)).toBe(true);
  });
  test("todos los rasgos importados son alcanzables desde su clase o subclase", () => {
    expect(unreachableFeatures(r.entries, ["subclassFeature:student of war|fighter|xphb|battle master|xphb|3"]))
      .toEqual([]);
    // Una elección escrita a mano para un rasgo que no se importa o no cuelga de nadie se lista
    expect(unreachableFeatures(r.entries, ["subclassFeature:nada|fighter|xphb|battle master|xphb|3"]))
      .toEqual(["subclassFeature:nada|fighter|xphb|battle master|xphb|3"]);
  });
});

test("rasgos anidados: no entra en bloques `options`, no duplica y sigue anidando", () => {
  const sub = (name: string, level: number, entries: unknown[]) => ({
    name, source: "XPHB", className: "Fighter", classSource: "XPHB",
    subclassShortName: "Champion", subclassSource: "XPHB", level, entries,
  });
  const nested = (name: string, level = 3) => ({
    type: "refSubclassFeature", subclassFeature: `${name}|Fighter|XPHB|Champion|XPHB|${level}`,
  });
  const { entries: es, errors: errs } = normalizeAll({
    classes: [{
      subclass: [{
        name: "Champion", shortName: "Champion", source: "XPHB", className: "Fighter", classSource: "XPHB",
        subclassFeatures: ["Champion|Fighter|XPHB|Champion|XPHB|3", "Uno|Fighter|XPHB|Champion|XPHB|3"],
      }],
      subclassFeature: [
        sub("Champion", 3, ["Texto", nested("Uno"), { type: "entries", entries: [nested("Dos")] },
          { type: "options", count: 1, entries: [nested("Opción")] }]),
        sub("Uno", 3, ["Uno"]),
        sub("Dos", 3, ["Dos", nested("Tres")]),
        sub("Tres", 3, ["Tres"]),
        sub("Opción", 3, ["Opción"]),
      ],
    }],
  }, "XPHB");
  expect(errs).toEqual([]);
  const features = (es.find((e) => e.key === "subclass:champion|fighter|xphb")!.data as SubclassData).features;
  expect(features.map((f) => f.ref.key.split("|")[0])).toEqual([
    "subclassFeature:champion", "subclassFeature:dos", "subclassFeature:tres", "subclassFeature:uno",
  ]);
});

test("rasgos de clase anidados (Artes marciales del Monje)", () => {
  const files: RawFiles = { classes: [fixture("class-monk.json")] };
  const { entries: es } = normalizeAll(files, "XPHB");
  const monk = es.find((e) => e.key === "class:monk|xphb")!.data as ClassData;
  const keys = monk.features.map((f) => f.ref.key);
  const at = keys.indexOf("classFeature:martial arts|monk|xphb|1");
  expect(keys.slice(at, at + 4)).toEqual([
    "classFeature:martial arts|monk|xphb|1", "classFeature:bonus unarmed strike|monk|xphb|1",
    "classFeature:martial arts die|monk|xphb|1", "classFeature:dexterous attacks|monk|xphb|1",
  ]);
});

test("opciones de rasgo de subclase y dentro de listas (`items`)", () => {
  const { entries: es, errors: errs } = normalizeAll({
    classes: [{
      subclassFeature: [{
        name: "Elección", source: "XPHB", className: "Fighter", classSource: "XPHB",
        subclassShortName: "Champion", subclassSource: "XPHB", level: 3,
        entries: [{ type: "list", items: [{ type: "options", count: 1, entries: [
          { type: "refSubclassFeature", subclassFeature: "Uno|Fighter|XPHB|Champion|XPHB|3" },
          { type: "refSubclassFeature", subclassFeature: "Dos|Fighter|XPHB|Champion|XPHB|3|XTEST" },
          { type: "refOptionalfeature", optionalfeature: "Parry|XPHB" },
        ] }] }],
      }],
    }],
  }, "XPHB");
  expect(errs).toEqual([]);
  expect((es[0].data as FeatureData).options?.map((o) => o.key)).toEqual([
    "subclassFeature:uno|fighter|xphb|champion|xphb|3",
    "subclassFeature:dos|fighter|xphb|champion|xphb|3|xtest",
    "optionalFeature:parry|xphb",
  ]);
});

describe("progresiones escritas a mano", () => {
  const base = {
    source: "XPHB", hd: { number: 1, faces: 8 }, proficiency: ["cha", "wis"], primaryAbility: [{ cha: true }],
    startingEquipment: { defaultData: [{ A: [{ value: 100 }] }] },
  };
  test("lista de 20 valores → acumulado solo donde cambia (Brujo) y libro de conjuros (Mago)", () => {
    const warlock = { ...base, name: "Warlock", optionalfeatureProgression: [{ name: "Eldritch Invocations", featureType: ["EI"],
      progression: [1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10] }] };
    const wizard = { ...base, name: "Wizard", spellsKnownProgressionFixed: [6, ...Array(19).fill(2)] };
    const { entries: es, errors: errs } = normalizeAll({ classes: [{ class: [warlock, wizard] }] }, "XPHB");
    expect(errs).toEqual([]);
    const data = (key: string) => es.find((e) => e.key === key)!.data as ClassData;
    expect(data("class:warlock|xphb").progressions.optionalFeatures[0].levels)
      .toEqual({ 1: 1, 2: 3, 5: 5, 7: 6, 9: 7, 12: 8, 15: 9, 18: 10 });
    expect(data("class:wizard|xphb").progressions.spellbook?.slice(0, 2)).toEqual([6, 2]);
    // Sin `subclassTitle` en los datos se usa el del diccionario; sin tabla, una tabla vacía que valida
    expect(data("class:wizard|xphb").subclassTitle).toBe("Tradición arcana");
    expect(data("class:wizard|xphb").table).toEqual({ columns: [] });
  });
  test("tabla con dados, velocidad y filas que faltan; habilidades de multiclase", () => {
    const monk = { ...base, name: "Monk",
      classTableGroups: [{ colLabels: ["Martial Arts", "Unarmored Movement", "Raro"], rows: [
        [{ type: "dice", toRoll: [{ number: 1, faces: 6 }] }, { type: "bonusSpeed", value: 0 }, "x"],
        [{ type: "dice", toRoll: [{ number: 2, faces: 6 }] }, { type: "bonusSpeed", value: 10 }, 3],
      ] }],
      multiclassing: { proficienciesGained: { skills: [{ choose: { from: ["stealth", "acrobatics"], count: 1 } }],
        tools: ["{@item Thieves' Tools|XPHB}"] } } };
    const { entries: es, errors: errs } = normalizeAll({ classes: [{ class: [monk] }] }, "XPHB");
    expect(errs).toEqual([]);
    const data = es[0].data as ClassData;
    expect(data.table.columns.map((c) => c.label)).toEqual(["Artes marciales", "Movimiento sin armadura", "Raro"]);
    expect(data.table.columns[0].values.slice(0, 3)).toEqual(["1d6", "2d6", ""]);
    expect(data.table.columns[1].values.slice(0, 2)).toEqual(["—", "+10 pies"]);
    expect(data.table.columns[2].values.slice(0, 2)).toEqual(["x", "3"]);
    expect(data.multiclass.proficiencies.skills).toEqual({ count: 1, from: ["stealth", "acrobatics"] });
    expect(data.multiclass.proficiencies.tools).toEqual(["Thieves' Tools"]);
  });
});

test("rasgos con elección en el texto sin especificar", () => {
  const feature = (key: string, description: string, data: Partial<FeatureData> = {}): NormalizedEntry => ({
    kind: key.startsWith("subclassFeature") ? "subclassFeature" : "classFeature", key, identifier: "", parent: null,
    name: key, description, srd52: false, data: { level: 1, className: "Rogue", ...data },
  });
  const list = [
    feature("classFeature:expertise|rogue|xphb|1", "You gain Expertise in two skills of your choice. Choose Stealth."),
    feature("classFeature:divine order|cleric|xphb|1", "Choose one.", { options: [{ book: "b", key: "k" }] }),
    feature("subclassFeature:x|rogue|xphb|y|xphb|3", "You CHOOSE one skill."),
    feature("classFeature:rage|barbarian|xphb|1", "Chooses nothing here."),
    feature("classFeature:specified|rogue|xphb|6", "Choose two skills."),
    feature("classFeature:primal knowledge|barbarian|xphb|3", "Proficiency in another skill of your choice."),
    feature("classFeature:ability score improvement|rogue|xphb|4", "A feat of your choice.", { asi: true }),
  ];
  expect(textChoiceFeatures(list, new Set(["classFeature:specified|rogue|xphb|6"]))).toEqual([
    "classFeature:expertise|rogue|xphb|1", "subclassFeature:x|rogue|xphb|y|xphb|3",
    "classFeature:primal knowledge|barbarian|xphb|3",
  ]);
});

describe("tablas de nombres (names.json, Guía de Xanathar)", () => {
  const { entries: names, errors: errs } = normalizeAll({ names: fixture("names.json") }, "XGE");
  const table = (species: string) => names.find((e) => e.key === `nameTable:${species}|xge`);

  test("Enano: femenina, masculina y clan; el clan duergar no es un apellido", () => {
    expect(errs).toEqual([]);
    const dwarf = table("dwarf");
    expect(dwarf).toMatchObject({ kind: "nameTable", name: "Dwarf", identifier: "dwarf" });
    const data = dwarf!.data as NameTableData;
    expect(data.species).toBe("dwarf");
    expect(data.tables.map((t) => [t.option, t.gender])).toEqual([
      ["Female", "female"], ["Male", "male"], ["Clan", "family"], ["Duergar Clan", "other"],
    ]);
    expect(data.tables[0].names).toEqual(["Anbera", "Artin", "Audhild", "Balifra"]);
  });
  test("Elfo: «Female Adult» es femenina, «Child» es otra y «Family» son apellidos", () => {
    const data = table("elf")!.data as NameTableData;
    expect(data.tables.map((t) => [t.option, t.gender])).toEqual([
      ["Child", "other"], ["Female Adult", "female"], ["Male Adult", "male"], ["Family", "family"],
    ]);
  });
  test("Humano: «Arabic, Female» es femenina", () => {
    const data = table("human")!.data as NameTableData;
    expect(data.tables[0]).toMatchObject({ option: "Arabic, Female", gender: "female" });
  });
});

test("objetos: la rareza solo se guarda en los mágicos", () => {
  const item = (name: string, rarity: string) => ({ name, source: "XPHB", type: "M", rarity, weapon: true, dmg1: "1d8" });
  const { entries: es } = normalizeAll({ items: { item: [item("Sword", "none"), item("Sword +1", "rare")] } }, "XPHB");
  expect((es.find((e) => e.key === "item:sword|xphb")!.data as ItemData).rarity).toBeUndefined();
  expect((es.find((e) => e.key === "item:sword +1|xphb")!.data as ItemData).rarity).toBe("rare");
});

describe("normalizeDefenses", () => {
  test("resistencias simples", () => {
    expect(normalizeDefenses({ resist: ["poison"] })).toEqual({ resist: ["poison"] });
  });
  test("elección con count 1 por defecto", () => {
    expect(normalizeDefenses({ resist: [{ choose: { from: ["acid", "fire"] } }] }))
      .toEqual({ resist: [{ choose: { from: ["acid", "fire"], count: 1 } }] });
  });
  test("descarta lo condicional", () => {
    expect(normalizeDefenses({ resist: [{ special: "x" }, { resist: ["fire"], note: "while raging", cond: true }] })).toBeUndefined();
  });
  test("estados en minúsculas", () => {
    expect(normalizeDefenses({ conditionImmune: ["Frightened"] })).toEqual({ conditionImmune: ["frightened"] });
  });
  test("arma con alcance: se guarda el original de 5etools", () => {
    const e = normalizeItem({ name: "Longbow", source: "XPHB", type: "R", weapon: true, dmg1: "1d8", dmgType: "P", range: "150/600" });
    expect((e.data as ItemData).weapon?.range).toBe("150/600");
    const m = normalizeItem({ name: "Club", source: "XPHB", type: "M", weapon: true, dmg1: "1d4", dmgType: "B" });
    expect((m.data as ItemData).weapon?.range).toBeUndefined();
  });
  test("objeto con resistencia fija", () => {
    const e = normalizeItem({ name: "Ring of Fire Resistance", source: "XDMG", type: "RG", resist: ["fire"] });
    expect((e.data as ItemData).defenses).toEqual({ resist: ["fire"] });
  });
  test("dote con elección de 2", () => {
    const e = normalizeFeat({ name: "X", source: "XPHB", category: "G", resist: [{ choose: { from: ["acid", "fire", "cold"], count: 2 } }] });
    expect((e.data as FeatData).defenses).toEqual({ resist: [{ choose: { from: ["acid", "fire", "cold"], count: 2 } }] });
  });
  test("linaje con resistencia propia", () => {
    const e = normalizeLineage(
      { name: "Tiefling; Infernal Legacy", source: "XPHB", resist: ["fire"], _versionEntries: [{ name: "Infernal Legacy", entries: ["x"] }] },
      { name: "Tiefling", source: "XPHB" },
    );
    expect((e.data as LineageData).defenses?.resist).toEqual(["fire"]);
  });
});

describe("acciones básicas (actions.json)", () => {
  const act = (name: string, time: unknown, source = "XPHB") => ({ name, source, srd52: true, time, entries: ["Texto."] });
  const raw = {
    actions: {
      action: [
        act("Dash", [{ number: 1, unit: "action" }]),
        act("Opportunity Attack", [{ number: 1, unit: "reaction" }]),
        act("Two-Weapon Fighting", [{ number: 1, unit: "bonus" }]),
        act("End Concentration", ["Free"]),
        act("Improvising an Action", ["Varies"]),
        act("Dash", [{ number: 1, unit: "action" }], "PHB"),
      ],
    },
  };
  const { entries: acts, errors: errs } = normalizeAll(raw, "XPHB");
  const time = (key: string) => (acts.find((e) => e.key === key)!.data as ActionData).time;

  test("clave, tipo y tiempo de cada acción; solo la fuente pedida", () => {
    expect(errs).toEqual([]);
    expect(acts.map((e) => e.key)).toEqual([
      "action:dash|xphb", "action:opportunity attack|xphb", "action:two-weapon fighting|xphb",
      "action:end concentration|xphb", "action:improvising an action|xphb",
    ]);
    expect(acts[0]).toMatchObject({ kind: "action", name: "Dash", identifier: "dash", srd52: true });
    expect(time("action:dash|xphb")).toBe("action");
    expect(time("action:opportunity attack|xphb")).toBe("reaction");
    expect(time("action:two-weapon fighting|xphb")).toBe("bonus");
    expect(time("action:end concentration|xphb")).toBe("free");
    expect(time("action:improvising an action|xphb")).toBe("varies");
  });
  test("nombre en español de Correr", () => {
    expect((es as Record<string, string>)["action:dash|xphb"]).toBe("Correr");
  });
  test("el diccionario traduce las 18 acciones del Manual", () => {
    expect(Object.keys(es).filter((k) => k.startsWith("action:"))).toHaveLength(18);
  });
});

describe("capacidad de contenedores", () => {
  const container = (containerCapacity?: unknown) =>
    (normalizeItem({ name: "Thing", source: "XPHB", type: "G", containerCapacity }).data as ItemData).container;

  test("mochila: peso", () => {
    expect(container({ weight: [30] })).toEqual({ weight: 30, volume: null, items: [], weightless: false });
  });
  test("bolsa de contención: sin peso propio", () => {
    expect(container({ weight: [500], weightless: true })).toMatchObject({ weight: 500, weightless: true });
  });
  test("mochila práctica de Heward: suma los compartimentos", () => {
    expect(container({ weight: [200, 200, 500], weightless: true })?.weight).toBe(900);
  });
  test("cofre: volumen", () => {
    expect(container({ volume: [12] })).toEqual({ weight: null, volume: 12, items: [], weightless: false });
  });
  test("estuche de virotes: objetos concretos con ref al libro", () => {
    expect(container({ item: [{ "bolt|xphb": 20 }] })?.items)
      .toEqual([{ ref: { book: "__BOOK__", key: "item:bolt|xphb" }, count: 20 }]);
  });
  test("frasco (volumen < 1) y objetos sin capacidad no son contenedores", () => {
    expect(container({ volume: [0.0625] })).toBeUndefined();
    expect(container(undefined)).toBeUndefined();
  });
  test("la importación sustituye el libro en container.items igual que en contents", () => {
    const e = normalizeItem({ name: "Bolt Case", source: "XPHB", type: "G", containerCapacity: { item: [{ "bolt|xphb": 20 }] } });
    const replaced = JSON.parse(JSON.stringify(e.data).replaceAll(JSON.stringify("__BOOK__"), JSON.stringify("book1")));
    expect((replaced as ItemData).container?.items[0].ref).toEqual({ book: "book1", key: "item:bolt|xphb" });
  });
});

describe("ids de columna y daño de conjuros", () => {
  test("las columnas de la tabla llevan el id de su etiqueta inglesa", () => {
    const cls = { ...fixture("class-barbarian.json").class[0],
      classTableGroups: [
        { colLabels: ["Rages", "Rage Damage", "Weapon Mastery"], rows: [] },
        { colLabels: ["{@filter Channel Divinity|spells|x=y}"], rows: [] },
        { title: "Spell Slots per Spell Level", colLabels: ["1st", "2nd"], rowsSpellProgression: [] },
      ] };
    const { entries: es, errors: errs } = normalizeAll({ classes: [{ class: [cls] }] }, "XPHB");
    expect(errs).toEqual([]);
    const cols = (es[0].data as ClassData).table.columns;
    expect(cols.map((c) => c.id)).toEqual(["rages", "rage-damage", "weapon-mastery", "channel-divinity", "slots-1", "slots-2"]);
    expect(cols.slice(0, 3).map((c) => c.label)).toEqual(["Furias", "Daño de furia", "Maestría con armas"]);
  });

  const spellData = (extra: Record<string, unknown>) => {
    const spell = { ...fixture("spells.json").spell[0], name: "Test", ...extra };
    delete (spell as Record<string, unknown>).scalingLevelDice;
    Object.assign(spell, extra);
    const r = normalizeAll({ spells: [{ spell: [spell] }] }, "XPHB");
    expect(r.errors).toEqual([]);
    return r.entries[0].data as SpellData;
  };
  const bolt = { label: "damage", scaling: { "1": "1d10", "5": "2d10", "11": "3d10", "17": "4d10" } };
  const boltScaling = [{ level: 1, dice: "1d10" }, { level: 5, dice: "2d10" }, { level: 11, dice: "3d10" }, { level: 17, dice: "4d10" }];

  test("truco con scalingLevelDice: dados por nivel de personaje", () => {
    expect(spellData({ level: 0, entries: ["Hit."], scalingLevelDice: bolt }).damage).toEqual({ dice: "1d10", scaling: boltScaling });
  });
  test("scalingLevelDice como array: se usa el primero", () => {
    expect(spellData({ level: 0, entries: ["Hit."], scalingLevelDice: [bolt, { label: "x", scaling: { "1": "9d9" } }] }).damage)
      .toEqual({ dice: "1d10", scaling: boltScaling });
  });
  test("sin scalingLevelDice: el primer {@damage} del texto", () => {
    expect(spellData({ level: 1, entries: ["Takes {@damage 3d6} Fire damage."] }).damage).toEqual({ dice: "3d6" });
  });
  test("sin {@damage} ni scalingLevelDice: sin daño", () => {
    expect(spellData({ level: 1, entries: ["Nothing."] })).not.toHaveProperty("damage");
  });
});
