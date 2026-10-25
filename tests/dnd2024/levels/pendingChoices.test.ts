import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Derived } from "@/lib/rules/dnd2024/derive";
import {
  FEATURE_CHOICES, FEATURE_OPTION_LABELS, NOT_A_CHOICE, SPECIFIED_CHOICES, SPELL_RULE_FEATURES,
} from "@/lib/rules/dnd2024/levels/featureChoices";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { meetsMulticlass, pendingChoices } from "@/lib/rules/dnd2024/levels/pendingChoices";
import type { Choice, Dnd2024SheetV2, LevelEntry } from "@/lib/rules/dnd2024/sheet/sheet";
import { normalizeAll, textChoiceFeatures } from "@/lib/rules/import/normalize";
import type { Ability, ClassData, Ref } from "@/lib/rules/types";
import { B, buildCatalog, ref } from "../fixtureCatalog";

const CLASS_FILES = ["barbarian", "cleric", "fighter", "sorcerer", "rogue", "ranger"].map((c) => `class-${c}.json`);
const catalog = buildCatalog(CLASS_FILES);
const fixture = (f: string) =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "../../fixtures/5etools", f), "utf8"));

const cls = (name: string) => ref(`class:${name}|xphb`);
const named = (r: Ref) => ({ ref: r, name: catalog.get(`${B}:${r.key}`)?.name ?? r.key });

// Hoja v2 con `levels` niveles en `classes` (en orden: [clase, niveles]); `extra` añade elecciones por nivel total
function sheetWith(classes: [string, number][], extra: Record<number, Choice[]> = {}): Dnd2024SheetV2 {
  const levels: LevelEntry[] = [];
  const perClass = new Map<string, number>();
  for (const [name, count] of classes) {
    for (let i = 0; i < count; i++) {
      const classLevel = (perClass.get(name) ?? 0) + 1;
      perClass.set(name, classLevel);
      const n = levels.length + 1;
      levels.push({
        n, class: named(cls(name)), classLevel, hp: { method: n === 1 ? "max" : "average", value: 7 },
        choices: extra[n] ?? [],
      });
    }
  }
  return {
    version: 2,
    species: named(ref("species:elf|xphb")),
    lineage: null,
    background: { ...named(ref("background:acolyte|xphb")), abilities: { wis: 2, int: 1 }, equipment: "A" },
    abilityMethod: "standard",
    baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    rolls: null,
    speciesChoices: { skills: [], size: null },
    alignment: "", appearance: "", age: "", languages: "", notes: "", xp: 0,
    hp: { max: null, current: null, temp: 0 },
    levels,
    classesSummary: [],
    inventory: { items: [], coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, other: "" },
    prepared: {},
    spellbookExtra: [],
    slotsUsed: {},
    weaponMasteries: [],
  };
}

const subclassChoice = (key: string): Choice =>
  ({ type: "subclass", source: "class:subclass", value: named(ref(key)) });
const types = (list: { type: string }[]) => list.map((c) => c.type);

describe("pendingChoices", () => {
  it("Bárbaro 2: ninguna elección", () => {
    expect(pendingChoices(sheetWith([["barbarian", 1]]), cls("barbarian"), 2, catalog)).toEqual([]);
  });

  it("Bárbaro 3: subclase y Conocimiento primigenio (1 habilidad)", () => {
    const r = pendingChoices(sheetWith([["barbarian", 2]]), cls("barbarian"), 3, catalog);
    expect(types(r)).toEqual(["subclass", "skills"]);
    expect(r[0]).toMatchObject({ source: "class:subclass", count: 1, label: "Senda primitiva" });
    expect(r[1]).toMatchObject({
      source: "classFeature:primal knowledge|barbarian|xphb|3", count: 1,
      from: ["animal handling", "athletics", "intimidation", "nature", "perception", "survival"],
    });
  });

  it("Bárbaro 4: mejora de característica y una maestría más (de 2 a 3)", () => {
    const r = pendingChoices(sheetWith([["barbarian", 3]]), cls("barbarian"), 4, catalog);
    expect(types(r)).toEqual(["asi", "weaponMastery"]);
    expect(r[0]).toMatchObject({ source: "classFeature:ability score improvement|barbarian|xphb|4", count: 1 });
    expect(r[1]).toMatchObject({ source: "progression:weapon mastery|barbarian|xphb", count: 1 });
  });

  it("Bárbaro 16: mejora de característica; Bárbaro 19: don épico (sin mejora)", () => {
    expect(types(pendingChoices(sheetWith([["barbarian", 15]]), cls("barbarian"), 16, catalog))).toEqual(["asi"]);
    const r = pendingChoices(sheetWith([["barbarian", 18]]), cls("barbarian"), 19, catalog);
    expect(r).toEqual([expect.objectContaining({
      type: "feat", source: "progression:eb|barbarian|xphb", count: 1, category: ["EB", "G"], label: "Don épico",
    })]);
  });

  it("Guerrero 1 (crear o rehacer la creación): habilidades de clase, estilo de combate y 3 maestrías", () => {
    const r = pendingChoices(sheetWith([]), cls("fighter"), 1, catalog);
    expect(types(r)).toEqual(["skills", "feat", "weaponMastery"]);
    expect(r[0]).toMatchObject({ source: "class:skills", count: 2 });
    expect(r[1]).toMatchObject({ source: "progression:fs|fighter|xphb", count: 1, category: ["FS"], label: "Estilo de combate" });
    expect(r[2]).toMatchObject({ count: 3 });
  });

  it("Guerrero 2: puede cambiar el estilo de combate (sin dote nueva)", () => {
    expect(pendingChoices(sheetWith([["fighter", 1]]), cls("fighter"), 2, catalog)).toEqual([expect.objectContaining({
      type: "feat", source: "progression:fs|fighter|xphb", count: 0, category: ["FS"], optionalReplace: true,
    })]);
  });

  it("Guerrero 3: maniobras del Maestro de batalla si se elige esa subclase en este nivel", () => {
    const sheet = sheetWith([["fighter", 2]]);
    // (el `feat` es la sustitución opcional del estilo de combate)
    expect(types(pendingChoices(sheet, cls("fighter"), 3, catalog))).toEqual(["subclass", "feat"]);
    const r = pendingChoices(sheet, cls("fighter"), 3, catalog, { subclass: ref("subclass:battle master|fighter|xphb") });
    expect(r[2]).toEqual(expect.objectContaining({
      type: "optionalFeature", source: "progression:maneuvers|battle master|fighter|xphb", count: 3,
      featureType: ["MV:B"], optionalReplace: false,
    }));
    // Student of War (anidado en la cabecera de la subclase); «Maneuver Options» no pide otra elección
    expect(r.slice(3)).toEqual([expect.objectContaining({
      type: "skills", source: "subclassFeature:student of war|fighter|xphb|battle master|xphb|3", count: 1,
    })]);
  });

  it("Guerrero 7: progresiones de la subclase que ya tiene (maniobras, estilo del Campeón)", () => {
    const bm = sheetWith([["fighter", 6]], { 3: [subclassChoice("subclass:battle master|fighter|xphb")] });
    const replaceStyle = expect.objectContaining({ type: "feat", source: "progression:fs|fighter|xphb", count: 0 });
    expect(pendingChoices(bm, cls("fighter"), 7, catalog)).toEqual([replaceStyle, expect.objectContaining({
      type: "optionalFeature", count: 2, featureType: ["MV:B"], optionalReplace: true,
    })]);
    const champion = sheetWith([["fighter", 6]], { 3: [subclassChoice("subclass:champion|fighter|xphb")] });
    expect(pendingChoices(champion, cls("fighter"), 7, catalog)).toEqual([replaceStyle, expect.objectContaining({
      type: "feat", source: "progression:fs|champion|fighter|xphb", count: 1, category: ["FS"],
    })]);
    expect(pendingChoices(champion, cls("fighter"), 7, catalog)[1].optionalReplace).toBeUndefined();
  });

  it("Hechicero 2: 2 metamagias (el rasgo «Metamagic Options» no pide otra elección)", () => {
    const r = pendingChoices(sheetWith([["sorcerer", 1]]), cls("sorcerer"), 2, catalog);
    expect(r).toEqual([expect.objectContaining({
      type: "optionalFeature", source: "progression:metamagic|sorcerer|xphb", count: 2, featureType: ["MM"],
      label: "Metamagia", optionalReplace: false,
    }), expect.objectContaining({ type: "spells", count: 2 })]);
  });

  it("Hechicero 3: solo puede sustituir una metamagia si ya conoce alguna", () => {
    expect(pendingChoices(sheetWith([["sorcerer", 2]]), cls("sorcerer"), 3, catalog)).toEqual([
      expect.objectContaining({ type: "subclass" }),
      expect.objectContaining({ type: "optionalFeature", source: "progression:metamagic|sorcerer|xphb", count: 0, optionalReplace: true }),
      expect.objectContaining({ type: "spells", count: 2 }),
    ]);
    // Sin metamagias conocidas (progresión que empieza más tarde) no hay nada que sustituir
    const late = new Map(catalog);
    const key = `${B}:class:sorcerer|xphb`;
    const data = structuredClone(late.get(key)!.data) as ClassData;
    data.progressions.optionalFeatures[0].levels = { 4: 2 };
    late.set(key, { ...late.get(key)!, data });
    expect(types(pendingChoices(sheetWith([["sorcerer", 2]]), cls("sorcerer"), 3, late))).toEqual(["subclass", "spells"]);
  });

  it("«… Options» con rasgos opcionales de otro tipo que el de la progresión: sí pide elegir", () => {
    const other = new Map(catalog);
    const key = `${B}:classFeature:metamagic options|sorcerer|xphb|2`;
    other.set(key, { ...other.get(key)!, data: { level: 2, className: "Sorcerer", options: [ref("optionalFeature:ascendant step|xphb")] } });
    expect(types(pendingChoices(sheetWith([["sorcerer", 1]]), cls("sorcerer"), 2, other))).toEqual(["optionalFeature", "featureOption", "spells"]);
  });

  it("opciones escritas a mano: ids estables con nombre en español", () => {
    const spec = FEATURE_CHOICES["subclassFeature:hunter's prey|ranger|xphb|hunter|xphb|3"][0];
    expect(spec.from).toEqual(["option:hunters-prey:colossus-slayer", "option:hunters-prey:horde-breaker"]);
    const ids = Object.values(FEATURE_CHOICES).flat().filter((c) => c.type === "featureOption").flatMap((c) => c.from ?? []);
    expect(ids.filter((id) => !FEATURE_OPTION_LABELS[id])).toEqual([]);
  });

  it("Clérigo 1: Orden divina con 2 opciones", () => {
    const r = pendingChoices(sheetWith([]), cls("cleric"), 1, catalog);
    expect(types(r)).toEqual(["skills", "featureOption", "spells"]);
    expect(r[1]).toMatchObject({ source: "classFeature:divine order|cleric|xphb|1", count: 1 });
    expect(r[1].options).toEqual([
      ref("classFeature:protector|cleric|xphb|1"), ref("classFeature:thaumaturge|cleric|xphb|1"),
    ]);
  });

  it("Pícaro 6: pericia en 2 habilidades", () => {
    expect(pendingChoices(sheetWith([["rogue", 5]]), cls("rogue"), 6, catalog)).toEqual([expect.objectContaining({
      type: "expertise", source: "classFeature:expertise|rogue|xphb|6", count: 2,
    })]);
  });

  it("entrada en Explorador como multiclase: 1 habilidad de su lista (y sus maestrías)", () => {
    const r = pendingChoices(sheetWith([["barbarian", 3]]), cls("ranger"), 1, catalog);
    expect(types(r)).toEqual(["skills", "weaponMastery", "spells"]);
    expect(r[0]).toMatchObject({ source: "multiclass:ranger|xphb", count: 1 });
    expect(r[0].from).toContain("stealth");
    expect(r[0].from).toHaveLength(8);
  });

  describe("conjuros (regla 8)", () => {
    const spellsOf = (r: ReturnType<typeof pendingChoices>) => r.find((p) => p.type === "spells");
    const progressions = (name: string) => (catalog.get(`${B}:class:${name}|xphb`)!.data as ClassData).progressions;

    it("Clérigo 1: sus trucos (modo list, sin conjuros aprendidos ni sustitución)", () => {
      const p = spellsOf(pendingChoices(sheetWith([]), cls("cleric"), 1, catalog));
      expect(p).toEqual({
        type: "spells", source: "progression:spells|cleric|xphb", count: progressions("cleric").cantrips![0], label: "Conjuros",
        spells: { class: cls("cleric"), mode: "list", list: "cleric", cantrips: 3, spells: 0, maxLevel: 1 },
      });
    });
    it("Clérigo 2: sin trucos nuevos, pero puede sustituir uno", () => {
      const p = spellsOf(pendingChoices(sheetWith([["cleric", 1]]), cls("cleric"), 2, catalog));
      expect(p).toMatchObject({ count: 0, optionalReplaceCantrip: true, spells: { cantrips: 0, spells: 0 } });
      // (modo list: no hay conjuros aprendidos que sustituir)
      expect(p?.optionalReplace).toBeUndefined();
    });
    it("Hechicero 1 y 3: trucos y conjuros aprendidos de su progresión; nivel máximo 2 a nivel 3", () => {
      const p = progressions("sorcerer");
      expect(spellsOf(pendingChoices(sheetWith([]), cls("sorcerer"), 1, catalog))).toMatchObject({
        count: p.cantrips![0] + p.prepared![0], spells: { mode: "levelUp", list: "sorcerer", cantrips: 4, spells: 2, maxLevel: 1 },
      });
      expect(spellsOf(pendingChoices(sheetWith([["sorcerer", 2]]), cls("sorcerer"), 3, catalog))).toMatchObject({
        optionalReplace: true, optionalReplaceCantrip: true,
        spells: { cantrips: p.cantrips![2] - p.cantrips![1], spells: p.prepared![2] - p.prepared![1], maxLevel: 2 },
      });
    });
    it("Caballero arcano: la subclase lanzadora, con la lista del Mago, al elegirla a nivel 3", () => {
      const ek = ref("subclass:eldritch knight|fighter|xphb");
      expect(spellsOf(pendingChoices(sheetWith([["fighter", 2]]), cls("fighter"), 3, catalog, { subclass: ek }))).toMatchObject({
        source: "progression:spells|eldritch knight|fighter|xphb",
        spells: { class: ek, mode: "levelUp", list: "wizard", cantrips: 2, spells: 3, maxLevel: 1 },
      });
      expect(spellsOf(pendingChoices(sheetWith([["fighter", 2]]), cls("fighter"), 3, catalog))).toBeUndefined();
    });
    it("Clérigo con Taumaturgo creado sin su truco de más: lo elige en la siguiente subida", () => {
      const thaumaturge: Choice = {
        type: "featureOption", source: "classFeature:divine order|cleric|xphb|1",
        value: named(ref("classFeature:thaumaturge|cleric|xphb|1")),
      };
      const cantrips = (names: string[]): Choice => ({
        type: "spells", source: "progression:spells|cleric|xphb",
        value: { class: cls("cleric"), cantrips: names.map((n) => named(ref(`spell:${n}|xphb`))), spells: [] },
      });
      const at2 = (names: string[]) =>
        spellsOf(pendingChoices(sheetWith([["cleric", 1]], { 1: [thaumaturge, cantrips(names)] }), cls("cleric"), 2, catalog));
      expect(at2(["light", "guidance", "sacred flame"])).toMatchObject({ count: 1, spells: { cantrips: 1 } });
      expect(at2(["light", "guidance", "sacred flame", "thaumaturgy"])).toMatchObject({ count: 0, spells: { cantrips: 0 } });
    });
    it("Bárbaro: ninguna", () => {
      expect(spellsOf(pendingChoices(sheetWith([]), cls("barbarian"), 1, catalog))).toBeUndefined();
    });
  });

  it("clase que no está en el catálogo: ninguna elección", () => {
    expect(pendingChoices(sheetWith([]), cls("bard"), 1, catalog)).toEqual([]);
  });
});

describe("meetsMulticlass", () => {
  const derivedWith = (scores: Partial<Record<Ability, number>>) => ({
    abilities: Object.fromEntries((["str", "dex", "con", "int", "wis", "cha"] as Ability[])
      .map((a) => [a, { score: scores[a] ?? 10, mod: 0 }])),
  }) as unknown as Derived;
  const entry = (name: string) => catalog.get(`${B}:class:${name}|xphb`)!;

  it("FUE 12 → no puede entrar en Bárbaro", () => {
    const sheet = sheetWith([["cleric", 1]]);
    expect(meetsMulticlass(sheet, derivedWith({ str: 12, wis: 14 }), entry("barbarian"), catalog))
      .toEqual({ ok: false, reason: "Necesitas 13 en Fuerza" });
    expect(meetsMulticlass(sheet, derivedWith({ str: 13, wis: 14 }), entry("barbarian"), catalog)).toEqual({ ok: true });
  });
  it("Explorador: necesita Destreza y Sabiduría a la vez", () => {
    const sheet = sheetWith([["cleric", 1]]);
    expect(meetsMulticlass(sheet, derivedWith({ dex: 13, wis: 12 }), entry("ranger"), catalog))
      .toEqual({ ok: false, reason: "Necesitas 13 en Sabiduría" });
    expect(meetsMulticlass(sheet, derivedWith({ dex: 13, wis: 13 }), entry("ranger"), catalog)).toEqual({ ok: true });
  });
  it("también exige el requisito de las clases actuales", () => {
    expect(meetsMulticlass(sheetWith([["cleric", 1]]), derivedWith({ str: 12, wis: 12 }), entry("barbarian"), catalog))
      .toEqual({ ok: false, reason: "Necesitas 13 en Sabiduría y 13 en Fuerza" });
  });
  it("con varias alternativas basta una (Guerrero: Fuerza o Destreza)", () => {
    const sheet = sheetWith([["cleric", 1]]);
    expect(meetsMulticlass(sheet, derivedWith({ dex: 13, wis: 13 }), entry("fighter"), catalog)).toEqual({ ok: true });
    expect(meetsMulticlass(sheet, derivedWith({ wis: 13 }), entry("fighter"), catalog))
      .toEqual({ ok: false, reason: "Necesitas 13 en Fuerza o 13 en Destreza" });
  });
  it("subir en una clase que ya tiene no es multiclase", () => {
    expect(meetsMulticlass(sheetWith([["barbarian", 1]]), derivedWith({}), entry("barbarian"), catalog)).toEqual({ ok: true });
  });
});

describe("rasgos con elección en el texto", () => {
  it("todos los de los fixtures tienen especificación", () => {
    const { entries } = normalizeAll({ classes: CLASS_FILES.map(fixture) }, "XPHB");
    expect(textChoiceFeatures(entries, SPECIFIED_CHOICES)).toEqual([]);
  });

  // Con los datos completos de 5etools (carpeta `data`, variable FIVEETOOLS_DATA): el informe del importador queda vacío
  const DATA = process.env.FIVEETOOLS_DATA ?? "C:/Users/Usuario/Documents/GitHub/5etools/5etools-src/data";
  it.skipIf(!existsSync(DATA))("XPHB completo (se salta si no está la carpeta de 5etools): todos tienen especificación y las claves existen", () => {
    const read = (f: string) => JSON.parse(readFileSync(path.join(DATA, f), "utf8"));
    const classes = readdirSync(path.join(DATA, "class"))
      .filter((f) => f.startsWith("class-") && f.endsWith(".json")).map((f) => read(`class/${f}`));
    const { entries } = normalizeAll({ classes, optionalFeatures: read("optionalfeatures.json") }, "XPHB");
    expect(textChoiceFeatures(entries, SPECIFIED_CHOICES)).toEqual([]);
    const keys = new Set(entries.map((e) => e.key));
    expect([...Object.keys(FEATURE_CHOICES), ...NOT_A_CHOICE, ...SPELL_RULE_FEATURES].filter((k) => !keys.has(k))).toEqual([]);
  });
});

describe("rasgos de conjuro de nivel alto", () => {
  const spellCatalog = buildCatalog(["class-bard.json", "class-warlock.json"]);
  const at = (name: string, level: number) => pendingChoices(sheetWith([[name, level - 1]]), cls(name), level, spellCatalog);

  it("Secretos mágicos y Arcano místico ya no están en NOT_A_CHOICE (los piden las reglas de conjuros)", () => {
    const keys = ["classFeature:magical secrets|bard|xphb|10",
      ...[11, 13, 15, 17].map((n) => `classFeature:mystic arcanum|warlock|xphb|${n}`)];
    for (const k of keys) {
      expect(NOT_A_CHOICE.has(k)).toBe(false);
      expect(SPELL_RULE_FEATURES.has(k)).toBe(true);
      expect(SPECIFIED_CHOICES.has(k)).toBe(true);
    }
  });
  it("Bardo 10 (y después): la elección de conjuros acepta las listas de Bardo, Clérigo, Druida y Mago", () => {
    const spellsAt = (level: number) => at("bard", level).find((p) => p.type === "spells")?.spells;
    expect(spellsAt(9)).toMatchObject({ list: "bard" });
    expect(spellsAt(9)?.lists).toBeUndefined();
    expect(spellsAt(10)).toMatchObject({ list: "bard", lists: ["bard", "cleric", "druid", "wizard"] });
    expect(spellsAt(11)?.lists).toEqual(["bard", "cleric", "druid", "wizard"]);
  });
  it("Brujo 11, 13, 15 y 17: un arcano de nivel 6, 7, 8 y 9 de la lista del Brujo; en los demás niveles, ninguno", () => {
    const arcanum = (level: number) => withArcana(level);
    expect(arcanum(11)).toEqual([{
      type: "arcanum", source: "classFeature:mystic arcanum|warlock|xphb|11", count: 1, label: "Arcano místico",
      arcanum: { level: 6, list: "warlock" },
    }]);
    expect(arcanum(13)[0].arcanum).toEqual({ level: 7, list: "warlock" });
    expect(arcanum(15)[0].arcanum).toEqual({ level: 8, list: "warlock" });
    expect(arcanum(17)[0].arcanum).toEqual({ level: 9, list: "warlock" });
    expect(arcanum(10)).toEqual([]);
  });
  // Arcanos elegidos en sus niveles (11, 13, 15 y 17) hasta `before`
  const ARCANUM = (n: number) => `classFeature:mystic arcanum|warlock|xphb|${n}`;
  const heldArcana = (before: number): Record<number, Choice[]> => Object.fromEntries([11, 13, 15, 17].filter((n) => n < before)
    .map((n) => [n, [{ type: "arcanum", source: ARCANUM(n), value: named(ref(`spell:arcanum ${n}|xphb`)) }]]));
  const withArcana = (level: number) =>
    pendingChoices(sheetWith([["warlock", level - 1]], heldArcana(level)), cls("warlock"), level, spellCatalog)
      .filter((p) => p.type === "arcanum");

  it("Arcano místico: desde Brujo 12, en cada nivel puede sustituir uno (con o sin arcano nuevo)", () => {
    const arcanum = withArcana;
    expect(arcanum(11)[0].optionalReplace).toBeUndefined();
    expect(arcanum(12)).toEqual([{
      type: "arcanum", source: "classFeature:mystic arcanum|warlock|xphb|11", count: 0, label: "Arcano místico",
      arcanum: { list: "warlock" }, optionalReplace: true,
    }]);
    expect(arcanum(13)).toEqual([{
      type: "arcanum", source: "classFeature:mystic arcanum|warlock|xphb|13", count: 1, label: "Arcano místico",
      arcanum: { level: 7, list: "warlock" }, optionalReplace: true,
    }]);
    expect(arcanum(20)).toMatchObject([{ source: "classFeature:mystic arcanum|warlock|xphb|17", count: 0, optionalReplace: true }]);
  });
  it("hojas de antes del Arcano místico: pide en la siguiente subida cada arcano de un nivel que no tiene", () => {
    // Brujo 12 sin arcanos que sube a 13: el de nivel 6 (del 11) y el de nivel 7 (del 13)
    expect(at("warlock", 13)).toEqual(expect.arrayContaining([
      { type: "arcanum", source: ARCANUM(11), count: 1, label: "Arcano místico (nivel 6)", arcanum: { level: 6, list: "warlock" } },
      { type: "arcanum", source: ARCANUM(13), count: 1, label: "Arcano místico", arcanum: { level: 7, list: "warlock" } },
    ]));
    expect(at("warlock", 13).filter((p) => p.type === "arcanum")).toHaveLength(2);
    // Brujo 11 sin arcano que sube a 12: el de nivel 6, sin sustitución (no tiene ninguno)
    expect(at("warlock", 12).filter((p) => p.type === "arcanum")).toEqual([
      { type: "arcanum", source: ARCANUM(11), count: 1, label: "Arcano místico (nivel 6)", arcanum: { level: 6, list: "warlock" } },
    ]);
    // Brujo 13 con el arcano de nivel 6 pero sin el de nivel 7 que sube a 14: el de nivel 7, y puede sustituir el que tiene
    const partial = pendingChoices(sheetWith([["warlock", 13]], { 11: heldArcana(12)[11] }), cls("warlock"), 14, spellCatalog)
      .filter((p) => p.type === "arcanum");
    expect(partial).toEqual([{
      type: "arcanum", source: ARCANUM(13), count: 1, label: "Arcano místico (nivel 7)", arcanum: { level: 7, list: "warlock" },
      optionalReplace: true,
    }]);
  });
});

describe("conjuros extra del Bardo del Saber y del Mago", () => {
  const spellCatalog = buildCatalog(["class-bard.json", "class-wizard.json"]);
  const LORE = "subclass:college of lore|bard|xphb";
  const DISCOVERIES = "subclassFeature:magical discoveries|bard|xphb|lore|xphb|6";
  // Clase `name` en el nivel `level - 1` con la subclase `sub` (elegida en el 3), que sube a `level`
  const withSub = (name: string, sub: string, level: number, opts: { known?: Ref[] } = {}) => {
    const s = sheetWith([[name, level - 1]], level > 3 ? { 3: [subclassChoice(sub)] } : {});
    return pendingChoices(s, cls(name), level, spellCatalog, { ...(level === 3 ? { subclass: ref(sub) } : {}), ...opts });
  };
  const ofType = (list: ReturnType<typeof pendingChoices>, type: string) => list.filter((p) => p.type === type);

  it("los rasgos tratados ya no están en NOT_A_CHOICE", () => {
    for (const k of [
      DISCOVERIES, "classFeature:spell mastery|wizard|xphb|18", "classFeature:signature spells|wizard|xphb|20",
      ...["abjuration savant|wizard|xphb|abjurer", "divination savant|wizard|xphb|diviner", "evocation savant|wizard|xphb|evoker",
        "illusion savant|wizard|xphb|illusionist", "improved illusions|wizard|xphb|illusionist"].map((k) => `subclassFeature:${k}|xphb|3`),
    ]) {
      expect(NOT_A_CHOICE.has(k)).toBe(false);
      expect(SPELL_RULE_FEATURES.has(k)).toBe(true);
    }
  });
  it("Saber 6: 2 conjuros de Clérigo, Druida o Mago (trucos o hasta el nivel 3) siempre preparados", () => {
    expect(ofType(withSub("bard", LORE, 6), "bonusSpells")).toEqual([{
      type: "bonusSpells", source: DISCOVERIES, count: 2, label: "Descubrimientos mágicos",
      bonusSpells: { class: cls("bard"), lists: ["cleric", "druid", "wizard"], maxLevel: 3, origin: "Descubrimientos mágicos" },
    }]);
    expect(ofType(withSub("bard", LORE, 5), "bonusSpells")).toEqual([]);
  });
  it("Saber 7 y después: solo sustituir uno (con el nivel máximo del nuevo nivel)", () => {
    const held: Choice = {
      type: "bonusSpells", source: DISCOVERIES,
      value: { spells: [named(ref("spell:bless|xphb")), named(ref("spell:guidance|xphb"))] },
    };
    const s = sheetWith([["bard", 6]], { 3: [subclassChoice(LORE)], 6: [held] });
    expect(ofType(pendingChoices(s, cls("bard"), 7, spellCatalog), "bonusSpells")).toEqual([{
      type: "bonusSpells", source: DISCOVERIES, count: 0, label: "Descubrimientos mágicos", optionalReplace: true,
      bonusSpells: { class: cls("bard"), lists: ["cleric", "druid", "wizard"], maxLevel: 4, origin: "Descubrimientos mágicos" },
    }]);
  });
  it("hojas de antes de Descubrimientos mágicos: Saber 7 sin ninguno elegido pide los 2", () => {
    expect(ofType(withSub("bard", LORE, 7), "bonusSpells")).toEqual([{
      type: "bonusSpells", source: DISCOVERIES, count: 2, label: "Descubrimientos mágicos",
      bonusSpells: { class: cls("bard"), lists: ["cleric", "druid", "wizard"], maxLevel: 4, origin: "Descubrimientos mágicos" },
    }]);
  });
  // Mago con la subclase `sub` hasta `level - 1` y las entradas gratis del Sabio que tocan hasta entonces
  const SAVANT_FREE: Record<number, number> = { 3: 2, 5: 1, 7: 1, 9: 1 };
  const withFree = (level: number) => {
    const extra: Record<number, Choice[]> = { 3: [subclassChoice("subclass:abjurer|wizard|xphb")] };
    for (const [n, count] of Object.entries(SAVANT_FREE)) {
      if (Number(n) >= level) continue;
      const free = Array.from({ length: count }, (_, i) => named(ref(`spell:free ${n} ${i}|xphb`)));
      const choice: Choice = { type: "spells", source: "progression:spells|wizard|xphb", value: { class: cls("wizard"), cantrips: [], spells: [], free } };
      extra[Number(n)] = [...(extra[Number(n)] ?? []), choice];
    }
    const sub = level === 3 ? { subclass: ref("subclass:abjurer|wizard|xphb") } : {};
    return pendingChoices(sheetWith([["wizard", level - 1]], extra), cls("wizard"), level, spellCatalog, sub);
  };

  it("Abjurador 3: 2 conjuros gratis de Abjuración de nivel 2 como máximo; 5: 1 de nivel 3; 4: ninguno", () => {
    const spellsAt = (level: number) => ofType(withFree(level), "spells")[0];
    expect(spellsAt(3).spells?.free).toEqual({ count: 2, school: "A", maxLevel: 2 });
    expect(spellsAt(3).count).toBe(4);
    expect(spellsAt(4).spells?.free).toBeUndefined();
    expect(spellsAt(5).spells?.free).toEqual({ count: 1, school: "A", maxLevel: 3 });
    expect(spellsAt(6).spells?.free).toBeUndefined();
    expect(spellsAt(7).spells?.free).toEqual({ count: 1, school: "A", maxLevel: 4 });
    // Hojas de antes del Sabio (ninguna gratis elegida): las que le faltan, con el nivel máximo actual
    const old = (level: number) => ofType(withSub("wizard", "subclass:abjurer|wizard|xphb", level), "spells")[0];
    expect(old(4).spells?.free).toEqual({ count: 2, school: "A", maxLevel: 2 });
    expect(old(5).spells?.free).toEqual({ count: 3, school: "A", maxLevel: 3 });
    expect(old(6).spells?.free).toEqual({ count: 3, school: "A", maxLevel: 3 });
    // Sin subclase con el rasgo, nada
    expect(pendingChoices(sheetWith([["wizard", 4]]), cls("wizard"), 5, spellCatalog).find((p) => p.type === "spells")?.spells?.free)
      .toBeUndefined();
  });
  it("Ilusionista 3: Ilusión menor sin elegir; si ya la conoce, 1 truco de Mago", () => {
    const ILLUSIONIST = "subclass:illusionist|wizard|xphb";
    expect(ofType(withSub("wizard", ILLUSIONIST, 3), "bonusSpells")).toEqual([]);
    expect(ofType(withSub("wizard", ILLUSIONIST, 3, { known: [ref("spell:light|xphb")] }), "bonusSpells")).toEqual([]);
    expect(ofType(withSub("wizard", ILLUSIONIST, 3, { known: [ref("spell:minor illusion|xphb")] }), "bonusSpells")).toEqual([{
      type: "bonusSpells", source: "subclassFeature:improved illusions|wizard|xphb|illusionist|xphb|3", count: 1,
      label: "Ilusiones mejoradas",
      bonusSpells: { class: cls("wizard"), lists: ["wizard"], cantripsOnly: true, origin: "Ilusiones mejoradas" },
    }]);
    expect(withSub("wizard", ILLUSIONIST, 3).find((p) => p.type === "spells")?.spells?.free).toEqual({ count: 2, school: "I", maxLevel: 2 });
  });
  it("Mago 20: 2 conjuros de nivel 3 de su libro (al final, tras la elección de conjuros del nivel)", () => {
    const r = pendingChoices(sheetWith([["wizard", 19]]), cls("wizard"), 20, spellCatalog);
    expect(r.at(-1)).toEqual({
      type: "bonusSpells", source: "classFeature:signature spells|wizard|xphb|20", count: 2, label: "Conjuros distintivos",
      bonusSpells: { class: cls("wizard"), lists: ["wizard"], level: 3, fromSpellbook: true, origin: "Conjuros distintivos" },
    });
    expect(ofType(pendingChoices(sheetWith([["wizard", 17]]), cls("wizard"), 18, spellCatalog), "bonusSpells")).toEqual([]);
  });
});

describe("chosenFeatSpells: Pacto del tomo sustituido y vuelto a elegir", () => {
  it("al sustituir la invocación se olvidan sus conjuros; al volver a elegirla, solo cuentan los nuevos", async () => {
    const { chosenFeatSpells } = await import("@/lib/rules/dnd2024/spells/featSpells");
    const TOME = named(ref("optionalFeature:pact of the tome|xphb"));
    const BLADE = named(ref("optionalFeature:pact of the blade|xphb"));
    const SOURCE = "progression:eldritch invocations|warlock|xphb";
    const fs = (names: string[]): Choice => ({
      type: "featSpells", source: `featSpells:${TOME.ref.key}`,
      value: { feat: TOME.ref, cantrips: names.map((n) => named(ref(`spell:${n}|xphb`))), spells: [] },
    });
    const s = sheetWith([["warlock", 3]], {
      1: [{ type: "optionalFeature", source: SOURCE, value: [TOME] }, fs(["guidance", "light", "thaumaturgy"])],
      2: [{ type: "optionalFeature", source: SOURCE, value: [BLADE], replaced: [TOME] }],
      3: [{ type: "optionalFeature", source: SOURCE, value: [TOME], replaced: [BLADE] }, fs(["druidcraft", "mending", "message"])],
    });
    expect(chosenFeatSpells(s.levels).get(refKey(TOME.ref))?.map((n) => n.ref.key))
      .toEqual(["spell:druidcraft|xphb", "spell:mending|xphb", "spell:message|xphb"]);
    // Sustituida y no vuelta a elegir: nada
    expect(chosenFeatSpells(s.levels.slice(0, 2)).get(refKey(TOME.ref))).toBeUndefined();
  });
});
