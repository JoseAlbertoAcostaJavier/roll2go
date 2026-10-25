import { describe, expect, test } from "vitest";
import { EMPTY_SPELL_FILTER, matchesSpellFilter, type SpellFilter } from "@/lib/rules/dnd2024/spells/spellFilters";

const fireball = { name: "Fireball", nameEs: "Bola de fuego", data: { level: 3, school: "V", tags: ["Daño de fuego", "Área: esfera"] } };
const light = { name: "Light", nameEs: "Luz", data: { level: 0, school: "V", tags: [] } };
const f = (over: Partial<SpellFilter>): SpellFilter => ({ ...EMPTY_SPELL_FILTER, ...over });

describe("matchesSpellFilter", () => {
  test("sin filtros pasa todo", () => {
    expect(matchesSpellFilter(fireball, EMPTY_SPELL_FILTER)).toBe(true);
  });
  test("nombre sin tildes ni mayúsculas, en español o en inglés", () => {
    expect(matchesSpellFilter(fireball, f({ name: "BOLA" }))).toBe(true);
    expect(matchesSpellFilter(fireball, f({ name: "fireb" }))).toBe(true);
    expect(matchesSpellFilter({ ...fireball, nameEs: "Rayo de escarcha" }, f({ name: "Ráyo" }))).toBe(true);
    expect(matchesSpellFilter(fireball, f({ name: "luz" }))).toBe(false);
  });
  test("niveles: 0 son los trucos; varios a la vez", () => {
    expect(matchesSpellFilter(light, f({ levels: [0] }))).toBe(true);
    expect(matchesSpellFilter(fireball, f({ levels: [0] }))).toBe(false);
    expect(matchesSpellFilter(fireball, f({ levels: [1, 3] }))).toBe(true);
  });
  test("escuela", () => {
    expect(matchesSpellFilter(fireball, f({ school: "V" }))).toBe(true);
    expect(matchesSpellFilter(fireball, f({ school: "A" }))).toBe(false);
  });
  test("etiquetas: tiene que tenerlas todas", () => {
    expect(matchesSpellFilter(fireball, f({ tags: ["Daño de fuego"] }))).toBe(true);
    expect(matchesSpellFilter(fireball, f({ tags: ["Daño de fuego", "Área: esfera"] }))).toBe(true);
    expect(matchesSpellFilter(fireball, f({ tags: ["Daño de fuego", "Curación"] }))).toBe(false);
  });
});
