import { describe, expect, test } from "vitest";
import { validateEntryData, normalizeName } from "@/lib/rules/schemas";
import type { ClassData } from "@/lib/rules/types";

const barbarianData: ClassData = {
  hitDie: 12,
  primaryAbility: ["str"],
  saves: ["str", "con"],
  armor: ["light", "medium", "shield"],
  weapons: ["simple", "martial"],
  tools: [],
  skills: { count: 2, from: ["animalHandling", "athletics", "intimidation"] },
  equipment: {
    A: [{ displayName: "Gran hacha", quantity: 1 }, { value: 1500 }],
    B: [{ value: 7500 }],
  },
  subclassLevel: 3,
  asiLevels: [4, 8, 12, 16],
  spellcasting: null,
  features: [{ ref: { book: "b", key: "rage" }, level: 1 }],
  progressions: {
    feats: [{ category: ["EB"], levels: { 19: 1 } }],
    optionalFeatures: [],
    weaponMastery: { 1: 2, 4: 3, 10: 4 },
    cantrips: null,
    prepared: null,
    spellbook: null,
  },
  table: { columns: [{ label: "Furias", values: Array(20).fill("2") }] },
  multiclass: {
    requirements: { abilities: ["str"], any: false },
    proficiencies: { armor: ["shield"], weapons: ["martial"], tools: [], skills: null },
  },
  subclassTitle: "Senda primitiva",
};

describe("validateEntryData", () => {
  test("species válida", () => {
    const r = validateEntryData("species", { size: ["M"], speed: 30, darkvision: 60, creatureType: "humanoid",
      skills: { fixed: ["perception"] }, spells: [], hasLineages: true });
    expect(r.ok).toBe(true);
  });
  test("species acepta elección de habilidades (elfo 2024)", () => {
    const r = validateEntryData("species", { size: ["M"], speed: 30, darkvision: 60, creatureType: "humanoid",
      skills: { fixed: [], choose: { count: 1, from: ["insight", "perception", "survival"] } },
      spells: [], hasLineages: true });
    expect(r.ok).toBe(true);
  });
  test("species rechaza tamaño inválido y devuelve la ruta", () => {
    const r = validateEntryData("species", { size: ["XL"], speed: 30, darkvision: 0, creatureType: "humanoid",
      skills: { fixed: [] }, spells: [], hasLineages: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toContain("size");
  });
  test("background exige exactamente 3 características", () => {
    const r = validateEntryData("background", { abilities: ["int", "wis"], feat: { book: "b", key: "k" },
      skills: [], tools: [], equipment: { A: [], B: [] } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain("abilities: deben ser 3");
  });
  test("background válido", () => {
    const r = validateEntryData("background", { abilities: ["int", "wis", "cha"], feat: { book: "b", key: "k" },
      skills: ["insight"], tools: [], equipment: { A: [], B: [] } });
    expect(r.ok).toBe(true);
  });
  test("class válida", () => {
    expect(validateEntryData("class", barbarianData).ok).toBe(true);
  });
  test("class rechaza hitDie no válido", () => {
    expect(validateEntryData("class", { ...barbarianData, hitDie: 7 }).ok).toBe(false);
  });
  test("class rechaza progresión de conjuros desconocida", () => {
    const casting = (extra: Record<string, unknown>) => validateEntryData("class",
      { ...barbarianData, spellcasting: { ability: "int", progression: "full", mode: "list", ...extra } }).ok;
    expect(casting({})).toBe(true);
    expect(casting({ progression: "quarter" })).toBe(false);
    expect(casting({ mode: "known" })).toBe(false);
  });
  test("subclass lanzadora declara su modo", () => {
    const sub = { features: [], spells: [], progressions: { feats: [], optionalFeatures: [] } };
    expect(validateEntryData("subclass", { ...sub, spellcasting: { ability: "int", progression: "third", mode: "levelUp" } }).ok)
      .toBe(true);
    expect(validateEntryData("subclass", { ...sub, spellcasting: { ability: "int", progression: "third" } }).ok).toBe(false);
  });
  test("spell rechaza nivel fuera de 0-9", () => {
    const base = { level: 3, school: "V", time: "1 acción", range: "60 pies", components: "V,S",
      duration: "Instantáneo", concentration: false, ritual: false, classes: ["wizard"], tags: [] };
    expect(validateEntryData("spell", base).ok).toBe(true);
    expect(validateEntryData("spell", { ...base, level: 10 }).ok).toBe(false);
  });
  test("feat rechaza categoría desconocida", () => {
    expect(validateEntryData("feat", { category: "origin", repeatable: false }).ok).toBe(true);
    expect(validateEntryData("feat", { category: "otra", repeatable: false }).ok).toBe(false);
  });
  test("classFeature exige level y className", () => {
    expect(validateEntryData("classFeature", { level: 1, className: "Bárbaro" }).ok).toBe(true);
    expect(validateEntryData("classFeature", { className: "Bárbaro" }).ok).toBe(false);
  });
  test("class: progresiones, tabla y multiclase", () => {
    const withData = (extra: Record<string, unknown>) => validateEntryData("class", { ...barbarianData, ...extra });
    expect(withData({ table: { columns: [{ label: "Furias", values: ["2"] }] } }).ok).toBe(false);
    expect(withData({ progressions: { ...barbarianData.progressions, weaponMastery: { 21: 2 } } }).ok).toBe(false);
    expect(withData({ progressions: { ...barbarianData.progressions, cantrips: Array(20).fill(3) } }).ok).toBe(true);
    expect(withData({ progressions: { ...barbarianData.progressions, optionalFeatures: [{ name: "Metamagic", levels: { 2: 2 } }] } }).ok)
      .toBe(false);
    expect(withData({ multiclass: { requirements: { abilities: ["str"], any: false },
      proficiencies: { armor: [], weapons: [], tools: [], skills: { count: 1, from: ["stealth"] } } } }).ok).toBe(true);
    const withoutTitle: Record<string, unknown> = { ...barbarianData };
    delete withoutTitle.subclassTitle;
    expect(validateEntryData("class", withoutTitle).ok).toBe(false);
  });
  test("subclass exige sus progresiones", () => {
    const sub = { features: [], spells: [] };
    const maneuvers = { name: "Maneuvers", featureType: ["MV:B"], levels: { 3: 3, 7: 5 } };
    expect(validateEntryData("subclass", { ...sub, progressions: { feats: [], optionalFeatures: [maneuvers] } }).ok).toBe(true);
    expect(validateEntryData("subclass", sub).ok).toBe(false);
    expect(validateEntryData("subclass", { ...sub, progressions: { feats: [{ category: ["FS"], levels: { 0: 1 } }],
      optionalFeatures: [] } }).ok).toBe(false);
  });
  test("classFeature con opciones y mejora de característica", () => {
    const options = [{ book: "b", key: "classFeature:protector|cleric|xphb|1" }];
    expect(validateEntryData("classFeature", { level: 1, className: "Cleric", options }).ok).toBe(true);
    expect(validateEntryData("subclassFeature", { level: 4, className: "Cleric", subclassName: "X", asi: true }).ok).toBe(true);
    expect(validateEntryData("classFeature", { level: 4, className: "Cleric", asi: false }).ok).toBe(false);
    expect(validateEntryData("classFeature", { level: 1, className: "Cleric", options: ["x"] }).ok).toBe(false);
  });
  test("optionalFeature exige featureType", () => {
    const pact = { book: "b", key: "optionalFeature:pact of the blade|xphb" };
    expect(validateEntryData("optionalFeature", { featureType: ["EI"], prerequisite: { level: 5, pact: pact.key } }).ok).toBe(true);
    expect(validateEntryData("optionalFeature", { featureType: ["MM"] }).ok).toBe(true);
    expect(validateEntryData("optionalFeature", { prerequisite: { level: 5 } }).ok).toBe(false);
    expect(validateEntryData("optionalFeature", { featureType: ["EI"], prerequisite: { spell: "x" } }).ok).toBe(false);
  });
  test("item con paquete y arma", () => {
    const r = validateEntryData("item", { type: "weapon", weight: 7, value: 3000,
      weapon: { damage: "1d12", damageType: "slashing", properties: ["heavy"], mastery: "cleave", category: "martial" } });
    expect(r.ok).toBe(true);
  });
  test("item con capacidad de contenedor", () => {
    const base = { type: "G", weight: 5, value: 200 };
    const ref = { book: "b", key: "item:bolt|xphb" };
    expect(validateEntryData("item", { ...base, container: { weight: 30, volume: null, items: [{ ref, count: 20 }], weightless: false } }).ok).toBe(true);
    expect(validateEntryData("item", { ...base, container: { weight: "30", volume: null, items: [], weightless: false } }).ok).toBe(false);
  });
  test("equipo: opciones por letra mayúscula, al menos una", () => {
    const withEquipment = (equipment: unknown) => validateEntryData("class", { ...barbarianData, equipment });
    expect(withEquipment({ A: [], B: [], C: [{ value: 15500 }] }).ok).toBe(true);
    expect(withEquipment({}).ok).toBe(false);
    expect(withEquipment({ a: [] }).ok).toBe(false);
    expect(withEquipment({ AB: [] }).ok).toBe(false);
    expect(withEquipment({ A: [{ value: "x" }] }).ok).toBe(false);
  });
  test("lineage acepta velocidad propia", () => {
    expect(validateEntryData("lineage", { speed: 35, spells: [], traitName: "Wood Elf" }).ok).toBe(true);
    expect(validateEntryData("lineage", { speed: "35", spells: [], traitName: "Wood Elf" }).ok).toBe(false);
  });
  test("el nivel de los conjuros concedidos es el nivel de personaje (1-20)", () => {
    const grant = (level: number) => ({ darkvision: 120, traitName: "Drow",
      spells: [{ level, ref: { book: "b", key: "faerie fire|xphb" } }] });
    expect(validateEntryData("lineage", grant(3)).ok).toBe(true);
    expect(validateEntryData("lineage", grant(17)).ok).toBe(true);
    expect(validateEntryData("lineage", grant(0)).ok).toBe(false);
    expect(validateEntryData("lineage", grant(21)).ok).toBe(false);
    const oath = (level: number) => ({ features: [], spells: [{ level, ref: { book: "b", key: "commune|xphb" } }],
      progressions: { feats: [], optionalFeatures: [] } });
    expect(validateEntryData("subclass", oath(17)).ok).toBe(true);
    expect(validateEntryData("subclass", oath(0)).ok).toBe(false);
  });
  test("lo que no es objeto se rechaza", () => {
    expect(validateEntryData("language", null).ok).toBe(false);
    expect(validateEntryData("skill", "x").ok).toBe(false);
  });
});

describe("normalizeName", () => {
  test("quita tildes y mayúsculas", () => {
    expect(normalizeName("Dracónido")).toBe("draconido");
    expect(normalizeName("ENANO")).toBe("enano");
  });
});
