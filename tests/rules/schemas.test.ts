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
    const r = validateEntryData("class", { ...barbarianData, spellcasting: { ability: "int", progression: "third", table: [] } });
    expect(r.ok).toBe(false);
  });
  test("spell rechaza nivel fuera de 0-9", () => {
    const base = { level: 3, school: "V", time: "1 acción", range: "60 pies", components: "V,S",
      duration: "Instantáneo", concentration: false, ritual: false, classes: ["wizard"] };
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
  test("item con paquete y arma", () => {
    const r = validateEntryData("item", { type: "weapon", weight: 7, value: 3000,
      weapon: { damage: "1d12", damageType: "slashing", properties: ["heavy"], mastery: "cleave", category: "martial" } });
    expect(r.ok).toBe(true);
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
    const oath = (level: number) => ({ features: [], spells: [{ level, ref: { book: "b", key: "commune|xphb" } }] });
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
