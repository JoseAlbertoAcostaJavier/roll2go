import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateName, nameTableFor, parsePronouns, pronounsText } from "@/lib/rules/dnd2024/creation/names";
import { normalizeAll } from "@/lib/rules/import/normalize";
import type { NameTableData } from "@/lib/rules/types";

const fixture = JSON.parse(readFileSync(path.join(import.meta.dirname, "../../fixtures/5etools/names.json"), "utf8"));
const tables = normalizeAll({ names: fixture }, "XGE").entries
  .filter((e) => e.kind === "nameTable")
  .map((e) => e.data as NameTableData);
const of = (species: string) => nameTableFor(tables, species)!;
const names = (species: string, gender: string) =>
  of(species).tables.filter((t) => t.gender === gender).flatMap((t) => t.names);

// Azar repetible: recorre la secuencia dada
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};
// Muchas tiradas con distintos valores, para ver de qué tablas salen
const many = (species: string, pronouns: ("he" | "she" | "they")[]) =>
  Array.from({ length: 200 }, (_, i) => generateName(of(species), pronouns, seq((i * 0.37) % 1, (i * 0.61) % 1, (i * 0.13) % 1, (i * 0.89) % 1)));

describe("generateName", () => {
  it("Él: nombre de la tabla masculina y clan (Enano)", () => {
    for (const n of many("dwarf", ["he"])) {
      const [first, ...rest] = n.split(" ");
      expect(names("dwarf", "male")).toContain(first);
      expect(names("dwarf", "family")).toContain(rest.join(" "));
    }
  });
  it("Ella: nombre de la tabla femenina (Elfo, con apellido de la tabla Family)", () => {
    for (const n of many("elf", ["she"])) {
      const [first, ...rest] = n.split(" ");
      expect(names("elf", "female")).toContain(first);
      expect(names("elf", "family")).toContain(rest.join(" "));
    }
  });
  it("Elle, o varios pronombres: de cualquiera de las dos tablas", () => {
    for (const pronouns of [["they"], ["he", "she"], []] as ("he" | "she" | "they")[][]) {
      const firsts = new Set(many("dwarf", pronouns).map((n) => n.split(" ")[0]));
      expect([...firsts].some((n) => names("dwarf", "male").includes(n))).toBe(true);
      expect([...firsts].some((n) => names("dwarf", "female").includes(n))).toBe(true);
      expect([...firsts].every((n) => [...names("dwarf", "male"), ...names("dwarf", "female")].includes(n))).toBe(true);
    }
  });
  it("Humano: sin tabla de apellidos, solo el nombre", () => {
    for (const n of many("human", ["she"])) expect(names("human", "female")).toContain(n);
  });
  it("especie sin tabla (Goliat) → tablas de Humano", () => {
    expect(of("goliath").species).toBe("human");
    for (const n of many("goliath", ["he"])) expect(names("human", "male")).toContain(n);
  });
  it("solo importa la fuente pedida (Gith es de otro libro)", () => {
    expect(tables.map((t) => t.species).sort()).toEqual(["dwarf", "elf", "human"]);
  });
});

describe("pronounsText", () => {
  it("en el orden Él, Ella, Elle", () => {
    expect(pronounsText(["they", "he"])).toBe("Él/Elle");
    expect(pronounsText([])).toBe("");
  });
});

describe("parsePronouns", () => {
  it("valida, quita repetidos y ordena", () => {
    expect(parsePronouns("they,he,he")).toEqual(["he", "they"]);
    expect(parsePronouns("")).toEqual([]);
    expect(parsePronouns("he,it")).toBeNull();
  });
});
