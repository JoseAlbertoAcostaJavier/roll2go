import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Derived } from "@/lib/rules/dnd2024/derive";
import { FEATURE_CHOICES, NOT_A_CHOICE, SPECIFIED_CHOICES } from "@/lib/rules/dnd2024/featureChoices";
import { meetsMulticlass, pendingChoices } from "@/lib/rules/dnd2024/levels";
import type { Choice, Dnd2024SheetV2, LevelEntry } from "@/lib/rules/dnd2024/sheet";
import { normalizeAll, textChoiceFeatures } from "@/lib/rules/import/normalize";
import type { Ability, Ref } from "@/lib/rules/types";
import { B, buildCatalog, ref } from "./fixtureCatalog";

const CLASS_FILES = ["barbarian", "cleric", "fighter", "sorcerer", "rogue", "ranger"].map((c) => `class-${c}.json`);
const catalog = buildCatalog(CLASS_FILES);
const fixture = (f: string) =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "../fixtures/5etools", f), "utf8"));

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
      type: "feat", source: "progression:eb|barbarian|xphb", count: 1, category: ["EB"], label: "Don épico",
    })]);
  });

  it("Guerrero 1 (crear o rehacer la creación): habilidades de clase, estilo de combate y 3 maestrías", () => {
    const r = pendingChoices(sheetWith([]), cls("fighter"), 1, catalog);
    expect(types(r)).toEqual(["skills", "feat", "weaponMastery"]);
    expect(r[0]).toMatchObject({ source: "class:skills", count: 2 });
    expect(r[1]).toMatchObject({ source: "progression:fs|fighter|xphb", count: 1, category: ["FS"], label: "Estilo de combate" });
    expect(r[2]).toMatchObject({ count: 3 });
  });

  it("Guerrero 3: maniobras del Maestro de batalla si se elige esa subclase en este nivel", () => {
    const sheet = sheetWith([["fighter", 2]]);
    expect(types(pendingChoices(sheet, cls("fighter"), 3, catalog))).toEqual(["subclass"]);
    const r = pendingChoices(sheet, cls("fighter"), 3, catalog, { subclass: ref("subclass:battle master|fighter|xphb") });
    expect(r[1]).toEqual(expect.objectContaining({
      type: "optionalFeature", source: "progression:maneuvers|battle master|fighter|xphb", count: 3,
      featureType: ["MV:B"], optionalReplace: false,
    }));
  });

  it("Guerrero 7: progresiones de la subclase que ya tiene (maniobras, estilo del Campeón)", () => {
    const bm = sheetWith([["fighter", 6]], { 3: [subclassChoice("subclass:battle master|fighter|xphb")] });
    expect(pendingChoices(bm, cls("fighter"), 7, catalog)).toEqual([expect.objectContaining({
      type: "optionalFeature", count: 2, featureType: ["MV:B"], optionalReplace: true,
    })]);
    const champion = sheetWith([["fighter", 6]], { 3: [subclassChoice("subclass:champion|fighter|xphb")] });
    expect(pendingChoices(champion, cls("fighter"), 7, catalog)).toEqual([expect.objectContaining({
      type: "feat", source: "progression:fs|champion|fighter|xphb", count: 1, category: ["FS"],
    })]);
  });

  it("Hechicero 2: 2 metamagias (el rasgo «Metamagic Options» no pide otra elección)", () => {
    const r = pendingChoices(sheetWith([["sorcerer", 1]]), cls("sorcerer"), 2, catalog);
    expect(r).toEqual([expect.objectContaining({
      type: "optionalFeature", source: "progression:metamagic|sorcerer|xphb", count: 2, featureType: ["MM"],
      label: "Metamagia", optionalReplace: false,
    })]);
  });

  it("Clérigo 1: Orden divina con 2 opciones", () => {
    const r = pendingChoices(sheetWith([]), cls("cleric"), 1, catalog);
    expect(types(r)).toEqual(["skills", "featureOption"]);
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
    expect(types(r)).toEqual(["skills", "weaponMastery"]);
    expect(r[0]).toMatchObject({ source: "multiclass:ranger|xphb", count: 1 });
    expect(r[0].from).toContain("stealth");
    expect(r[0].from).toHaveLength(8);
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

  // Con los datos completos de 5etools, si están en la máquina: el informe del importador queda vacío para el XPHB
  const DATA = "C:/Users/Usuario/Documents/GitHub/5etools/5etools-src/data";
  it.skipIf(!existsSync(DATA))("todos los del XPHB tienen especificación y las claves existen", () => {
    const read = (f: string) => JSON.parse(readFileSync(path.join(DATA, f), "utf8"));
    const classes = readdirSync(path.join(DATA, "class"))
      .filter((f) => f.startsWith("class-") && f.endsWith(".json")).map((f) => read(`class/${f}`));
    const { entries } = normalizeAll({ classes, optionalFeatures: read("optionalfeatures.json") }, "XPHB");
    expect(textChoiceFeatures(entries, SPECIFIED_CHOICES)).toEqual([]);
    const keys = new Set(entries.map((e) => e.key));
    expect([...Object.keys(FEATURE_CHOICES), ...NOT_A_CHOICE].filter((k) => !keys.has(k))).toEqual([]);
  });
});
