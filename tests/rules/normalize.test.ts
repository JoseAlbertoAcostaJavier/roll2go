import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { inlineTags } from "@/lib/rules/import/toBbcode";
import {
  normalizeAll, expandVersions, resolveCopy, toIdentifier,
  type NormalizedEntry, type RawFiles,
} from "@/lib/rules/import/normalize";
import type {
  BackgroundData, ClassData, ItemData, LineageData, SpeciesData, SpellData, SubclassData,
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
  expect(cleric!.data).toMatchObject({ category: "origin", repeatable: true });
  expect(cleric!.description).not.toContain("Druid");
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
  test("rasgos y equipo", () => {
    expect(data.features[0]).toEqual({ ref: { book: "__BOOK__", key: "classFeature:rage|barbarian|xphb|1" }, level: 1 });
    expect(data.equipment.A[1]).toEqual({ ref: { book: "__BOOK__", key: "item:handaxe|xphb" }, quantity: 4 });
  });
  test("rasgos de clase con la clase como padre", () => {
    const rage = find("classFeature", "classFeature:rage|barbarian|xphb|1")!;
    expect(rage.parent).toEqual({ key: "class:barbarian|xphb" });
    expect(rage.data).toEqual({ level: 1, className: "Barbarian" });
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
  expect(data.classes).toContain("wizard");
  expect(data.time).toBe("1 action");
  expect(data.range).toBe("150 feet");
  expect(data.components).toBe("V, S, M (a ball of bat guano and sulfur)");
  expect(data.duration).toBe("Instantaneous");
  expect(data.concentration).toBe(false);
  expect(fb.description).toContain("Using a Higher-Level Spell Slot");
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
  expect(data("class:wizard|xphb").spellcasting).toEqual({ ability: "int", progression: "full", table: [[2, 0], [3, 0], [4, 2]] });
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
