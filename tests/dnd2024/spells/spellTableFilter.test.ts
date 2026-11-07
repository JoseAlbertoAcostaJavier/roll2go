import { describe, expect, it } from "vitest";
import {
  EMPTY_SPELL_TABLE_FILTER, groupByLevel, matchesSpellTable, parseSpellTableFilter, spellTableHref, spellViewHref,
} from "@/lib/rules/dnd2024/spells/spellTableFilter";
import type { SpellRow } from "@/lib/rules/dnd2024/spells/spellTable";

const row = (name: string, nameEn: string, level: number, over: Partial<SpellRow> = {}): SpellRow => ({
  ref: { book: "b", key: `spell:${nameEn}|xphb` }, key: `b:spell:${nameEn}|xphb`, name, nameEn, level, school: "V", schoolId: "V",
  time: "1 acción", timeShort: "1 A", range: "18 m", duration: "Instantáneo", components: "V, S",
  concentration: false, ritual: false, hit: null, effect: null, damage: null, prepare: null, origin: "Mago", limited: null, casterClass: null,
  tags: [], ...over,
});
const fireBolt = row("Descarga de fuego", "Fire Bolt", 0, { tags: ["Daño de fuego", "Ataque de conjuro"] });
const fear = row("Miedo", "Fear", 3, { tags: ["Estado: asustado", "Concentración"], concentration: true });
const shield = row("Escudo", "Shield", 1, { time: "1 reacción, que tomas cuando te golpean" });
const alarm = row("Alarma", "Alarm", 1, { tags: ["Ritual"], ritual: true });
const f = (p: Partial<typeof EMPTY_SPELL_TABLE_FILTER>) => ({ ...EMPTY_SPELL_TABLE_FILTER, ...p });

describe("matchesSpellTable", () => {
  it("busca sin distinguir mayúsculas ni tildes", () => {
    expect(matchesSpellTable(fireBolt, f({ q: "fuego" }))).toBe(true);
    expect(matchesSpellTable(fireBolt, f({ q: "FUEGO" }))).toBe(true);
    expect(matchesSpellTable(fear, f({ q: "asust" }))).toBe(true);
    expect(matchesSpellTable(shield, f({ q: "reacción" }))).toBe(true);
    expect(matchesSpellTable(shield, f({ q: "reaccion" }))).toBe(true);
    expect(matchesSpellTable(fireBolt, f({ q: "fire bolt" }))).toBe(true);
    expect(matchesSpellTable(shield, f({ q: "fuego" }))).toBe(false);
  });
  it("q vacío o con espacios no filtra", () => {
    expect(matchesSpellTable(shield, f({ q: "   " }))).toBe(true);
  });
  it("tipo, nivel, concentración y ritual", () => {
    expect(matchesSpellTable(fireBolt, f({ kind: "cantrips" }))).toBe(true);
    expect(matchesSpellTable(shield, f({ kind: "cantrips" }))).toBe(false);
    expect(matchesSpellTable(fireBolt, f({ kind: "spells" }))).toBe(false);
    expect(matchesSpellTable(shield, f({ kind: "spells" }))).toBe(true);
    expect(matchesSpellTable(shield, f({ levels: [1] }))).toBe(true);
    expect(matchesSpellTable(fear, f({ levels: [1] }))).toBe(false);
    expect(matchesSpellTable(fear, f({ concentration: "yes" }))).toBe(true);
    expect(matchesSpellTable(shield, f({ concentration: "yes" }))).toBe(false);
    expect(matchesSpellTable(shield, f({ concentration: "no" }))).toBe(true);
    expect(matchesSpellTable(fear, f({ concentration: "no" }))).toBe(false);
    expect(matchesSpellTable(alarm, f({ ritual: "yes" }))).toBe(true);
    expect(matchesSpellTable(shield, f({ ritual: "yes" }))).toBe(false);
    expect(matchesSpellTable(shield, f({ ritual: "no" }))).toBe(true);
    expect(matchesSpellTable(alarm, f({ ritual: "no" }))).toBe(false);
  });
});

describe("parseSpellTableFilter", () => {
  it("lee la URL e ignora lo desconocido", () => {
    expect(parseSpellTableFilter({ q: "fuego", tipo: "trucos", nivel: "1,x,12", conc: "si", ritual: "raro" })).toEqual({
      q: "fuego", kind: "cantrips", levels: [1], concentration: "yes", ritual: "any",
    });
    expect(parseSpellTableFilter({})).toEqual(EMPTY_SPELL_TABLE_FILTER);
    expect(parseSpellTableFilter({ tipo: "conjuros", nivel: "0,9,9", conc: "no", ritual: "si" })).toMatchObject({
      kind: "spells", levels: [0, 9], concentration: "no", ritual: "yes",
    });
  });
});

describe("spellTableHref", () => {
  it("mantiene tab, quita spell y saved y omite los valores por defecto", () => {
    const q = { tab: "conjuros", spell: "x", saved: "1", q: "fuego", otro: "a" };
    expect(spellTableHref(q, {})).toBe("?tab=conjuros&otro=a&q=fuego");
    expect(spellTableHref(q, { q: "" })).toBe("?tab=conjuros&otro=a");
    expect(spellTableHref({ tab: "conjuros" }, { kind: "cantrips", levels: [1, 2], concentration: "yes", ritual: "no" }))
      .toBe("?tab=conjuros&tipo=trucos&nivel=1%2C2&conc=si&ritual=no");
    expect(spellTableHref({ tab: "conjuros", tipo: "trucos" }, { kind: "all" })).toBe("?tab=conjuros");
  });
});

describe("groupByLevel", () => {
  it("agrupa por nivel y ordena por nombre, sin niveles vacíos", () => {
    const g = groupByLevel([fear, shield, fireBolt, alarm]);
    expect(g.map((x) => x.level)).toEqual([0, 1, 3]);
    expect(g[1].rows.map((r) => r.name)).toEqual(["Alarma", "Escudo"]);
  });
});

describe("spellViewHref", () => {
  it("añade o quita la vista de gestión y conserva filtros y pestaña", () => {
    expect(spellViewHref({ tab: "conjuros", q: "fuego", spell: "x", saved: "1" }, true))
      .toBe("?tab=conjuros&q=fuego&vista=gestionar");
    expect(spellViewHref({ tab: "conjuros", vista: "gestionar", q: "fuego" }, false)).toBe("?tab=conjuros&q=fuego");
  });
});
