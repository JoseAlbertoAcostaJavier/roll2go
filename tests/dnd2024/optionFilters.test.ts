import { describe, expect, it } from "vitest";
import type { EntryOption } from "@/lib/rules/catalog/types";
import { classFacets, filterGroups, matchesFilters, matchesSearch, speciesFacets, toggleFilter } from "@/lib/rules/dnd2024/optionFilters";
import { normalizeSpecies } from "@/lib/rules/import/normalize";
import { validateEntryData } from "@/lib/rules/schemas";

const option = (name: string, data: unknown, bookName = "Libro A", nameEs: string | null = null) =>
  ({ ref: { book: "b", key: name }, name, nameEs, bookName, srd52: false, data }) as EntryOption;
const species = (over: object = {}) => ({ size: ["M"], speed: 30, darkvision: 0, creatureType: "humanoid", skills: { fixed: [] }, spells: [], hasLineages: false, ...over });
const klass = (over: object = {}) => ({ hitDie: 8, primaryAbility: ["int"], armor: [], weapons: ["simple"], spellcasting: null, ...over });

describe("especies", () => {
  it("resume libro, tamaño, tipo y rasgos", () => {
    const f = speciesFacets(option("Tortle", species({ size: ["S", "M"], naturalArmor: true }), "Mordenkainen"));
    expect(f).toEqual({ book: ["Mordenkainen"], size: ["S", "M"], creatureType: ["humanoid"], magic: ["no"], armor: ["yes"], resist: ["no"] });
  });

  it("la magia y las resistencias de un legado cuentan", () => {
    const lineage = option("Alto", { spells: [{ level: 1 }], defenses: { resist: ["fire"] } });
    expect(speciesFacets(option("Elfo", species({ hasLineages: true })), [lineage])).toMatchObject({ magic: ["yes"], resist: ["yes"] });
  });

  it("el importador marca la armadura natural y pasa la validación", () => {
    const ctx = { skillNames: [] } as never;
    const tortle = normalizeSpecies({ name: "Tortle", source: "MPMM", size: ["M"], traitTags: ["Natural Armor"] }, ctx);
    expect(tortle.data).toMatchObject({ naturalArmor: true });
    expect(validateEntryData("species", tortle.data).ok).toBe(true);
    expect(normalizeSpecies({ name: "Humano", source: "XPHB", size: ["M"] }, ctx).data).not.toHaveProperty("naturalArmor");
  });
});

describe("clases", () => {
  it("distingue armas marciales enteras de parciales y la falta de armadura", () => {
    const monk = classFacets(option("Monk", klass({ weapons: ["simple", "Martial weapons that have the Light property"] })));
    expect(monk).toMatchObject({ armor: ["none"], weapons: ["simple", "someMartial"], hitDie: ["8"] });
    expect(classFacets(option("Fighter", klass({ armor: ["light", "shield"], weapons: ["simple", "martial"] })))).toMatchObject({ armor: ["light", "shield"], weapons: ["simple", "martial"] });
  });

  it("sin característica principal usa la de sus conjuros", () => {
    expect(classFacets(option("Artificer", klass({ primaryAbility: [], spellcasting: { ability: "int" } }))).primary).toEqual(["int"]);
  });
});

describe("filtrar", () => {
  const facets = { book: ["A"], size: ["S", "M"], magic: ["no"] };

  it("un valor basta dentro de un grupo; entre grupos hacen falta todos", () => {
    expect(matchesFilters(facets, {})).toBe(true);
    expect(matchesFilters(facets, { size: ["M", "L"] })).toBe(true);
    expect(matchesFilters(facets, { size: ["L"] })).toBe(false);
    expect(matchesFilters(facets, { size: ["M"], magic: ["yes"] })).toBe(false);
  });

  it("marcar dos veces deja el grupo fuera", () => {
    const on = toggleFilter({}, "size", "M");
    expect(on).toEqual({ size: ["M"] });
    expect(toggleFilter(on, "size", "L")).toEqual({ size: ["M", "L"] });
    expect(toggleFilter(on, "size", "M")).toEqual({});
  });

  it("los grupos salen ordenados y solo si hay algo que elegir", () => {
    const groups = filterGroups("class", [{ book: ["A"], hitDie: ["12"] }, { book: ["A"], hitDie: ["6"] }]);
    expect(groups).toEqual([{ id: "hitDie", label: "Dado de golpe", options: [{ id: "6", label: "d6" }, { id: "12", label: "d12" }] }]);
  });

  it("la búsqueda mira ambos nombres, sin tildes", () => {
    const o = option("Wizard", {}, "A", "Mágico");
    expect(matchesSearch(o, "magi")).toBe(true);
    expect(matchesSearch(o, "wiz")).toBe(true);
    expect(matchesSearch(o, "bardo")).toBe(false);
    expect(matchesSearch(o, "  ")).toBe(true);
  });
});
