import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { innateKey, type CasterBlock, type SpellsSummary } from "@/lib/rules/dnd2024/derive/spells";
import { spellDamageAt, spellTableRows, timeShort } from "@/lib/rules/dnd2024/spells/spellTable";
import type { Ref, SpellData } from "@/lib/rules/types";

const B = "b";
const ref = (key: string): Ref => ({ book: B, key });
const spell = (key: string, nameEs: string, level: number, time: string, tags: string[] = []): CatalogEntry => ({
  ref: ref(key), name: key, nameEs, bookName: "Libro", srd52: false, description: "", descriptionEs: "",
  identifier: "", parent: null, foundry: null,
  data: {
    level, school: "V", time, range: "18 metros", components: "V, S", duration: "Instantáneo",
    concentration: tags.includes("Concentración"), ritual: tags.includes("Ritual"), classes: ["wizard"], tags,
  } satisfies SpellData,
});
const ENTRIES = [
  spell("spell:fire bolt|xphb", "Descarga de fuego", 0, "1 acción", ["Daño de fuego", "Ataque de conjuro"]),
  spell("spell:friends|xphb", "Amigos", 0, "1 acción", ["Salvación de Sabiduría", "Estado: Hechizado", "Concentración"]),
  spell("spell:shield|xphb", "Escudo", 1, "1 reacción, que tomas cuando…", ["Modifica la CA"]),
  spell("spell:alarm|xphb", "Alarma", 1, "1 minuto", ["Ritual"]),
  spell("spell:sleep|xphb", "Dormir", 1, "1 acción"),
  spell("spell:misty step|xphb", "Paso brumoso", 2, "1 acción adicional"),
  spell("spell:fly|xphb", "Volar", 3, "1 acción"),
  spell("spell:arcane gate|xphb", "Puerta arcana", 6, "1 acción", ["Teletransporte"]),
  spell("spell:thaumaturgy|xphb", "Taumaturgia", 0, "1 acción"),
];
const entries = new Map(ENTRIES.map((e) => [`${B}:${e.ref.key}`, e]));
const named = (key: string) => ({ ref: ref(key), name: key });

const block: CasterBlock = {
  class: ref("class:wizard|xphb"), name: "Mago", ability: "wis", mode: "spellbook", dc: 13, attack: 5,
  cantripLimit: 3, preparedLimit: 4, maxSpellLevel: 6, known: [],
  cantrips: [named("spell:fire bolt|xphb"), named("spell:friends|xphb")],
  prepared: [ref("spell:shield|xphb")],
  spellbook: [named("spell:shield|xphb"), named("spell:sleep|xphb")],
  always: [],
  limited: [{ key: "arcanum:x", spell: named("spell:arcane gate|xphb"), origin: "Arcano místico", max: 1, used: 1 }],
};
const summary: SpellsSummary = {
  blocks: [block], slots: { levels: {}, pact: null }, used: {}, limitedUsed: {},
  other: [
    { spell: named("spell:misty step|xphb"), origin: "Especie: Tiefling", innate: true },
    { spell: named("spell:thaumaturgy|xphb"), origin: "Especie: Tiefling", innate: true },
    { spell: named("spell:fly|xphb"), origin: "Invocación: Ascendent Step" },
  ],
};
const rows = spellTableRows(summary, entries);
const row = (name: string) => rows.find((r) => r.name === name)!;

describe("spellTableRows", () => {
  it("incluye trucos, preparados, limitados y otros; no el libro sin preparar", () => {
    expect(rows.map((r) => r.name).sort()).toEqual(
      ["Amigos", "Descarga de fuego", "Escudo", "Paso brumoso", "Puerta arcana", "Taumaturgia", "Volar"]);
    expect(rows.find((r) => r.name === "Dormir")).toBeUndefined();
  });
  it("calcula hit como en Acciones", () => {
    expect(row("Descarga de fuego").hit).toBe("+5");
    expect(row("Amigos").hit).toBe("CD 13 SAB");
    expect(row("Paso brumoso").hit).toBeNull();
  });
  it("calcula el efecto", () => {
    expect(row("Descarga de fuego").effect).toEqual({ damageTypeId: "fire", label: "Fuego" });
    expect(row("Amigos").effect).toEqual({ damageTypeId: null, label: "Hechizado" });
    expect(row("Escudo").effect).toEqual({ damageTypeId: null, label: "Modifica la CA" });
    expect(row("Paso brumoso").effect).toBeNull();
  });
  it("rellena origen, bloque, limitados y datos del conjuro", () => {
    const g = row("Puerta arcana");
    expect(g.limited).toEqual({ key: "arcanum:x", max: 1, used: 1 });
    expect(g.origin).toBe("Arcano místico");
    expect(row("Escudo").limited).toBeNull();
    expect(row("Escudo").casterClass).toEqual(block.class);
    expect(row("Paso brumoso").casterClass).toBeNull();
    expect(row("Escudo")).toMatchObject({
      nameEn: "spell:shield|xphb", key: `${B}:spell:shield|xphb`, level: 1, school: "Evocación", schoolId: "V", timeShort: "1R",
    });
    expect(row("Amigos")).toMatchObject({ concentration: true, ritual: false });
  });
  it("especie, legado y dotes: un uso gratis por descanso largo en los de nivel 1+, no en trucos ni invocaciones", () => {
    const key = innateKey(ref("spell:misty step|xphb"));
    expect(row("Paso brumoso").limited).toEqual({ key, max: 1, used: 0 });
    expect(row("Taumaturgia").limited).toBeNull();
    expect(row("Volar").limited).toBeNull();
    const spent = spellTableRows({ ...summary, limitedUsed: { [key]: 1 } }, entries);
    expect(spent.find((r) => r.name === "Paso brumoso")!.limited).toEqual({ key, max: 1, used: 1 });
  });
});

describe("timeShort", () => {
  it.each([
    ["1 acción", "1A"], ["1 acción adicional", "1AA"], ["1 reacción, que tomas cuando…", "1R"],
    ["10 minutos", "10 min"], ["1 hora", "1 h"], ["8 horas", "8 h"], ["1 minuto", "1 min"], ["Especial", "Especial"],
  ])("%s → %s", (time, short) => expect(timeShort(time)).toBe(short));
});

describe("spellDamageAt", () => {
  const withDamage = (damage?: SpellData["damage"]): SpellData => ({
    level: 0, school: "V", time: "1 acción", range: "", components: "", duration: "", concentration: false, ritual: false,
    classes: [], tags: [], ...(damage ? { damage } : {}),
  });
  const fireBolt = withDamage({
    dice: "1d10", scaling: [{ level: 1, dice: "1d10" }, { level: 5, dice: "2d10" }, { level: 11, dice: "3d10" }, { level: 17, dice: "4d10" }],
  });
  it("truco: el último escalón alcanzado por el nivel del personaje", () => {
    expect(spellDamageAt(fireBolt, 1)).toBe("1d10");
    expect(spellDamageAt(fireBolt, 4)).toBe("1d10");
    expect(spellDamageAt(fireBolt, 5)).toBe("2d10");
    expect(spellDamageAt(fireBolt, 17)).toBe("4d10");
  });
  it("conjuro de nivel 1+: sus dados", () => {
    expect(spellDamageAt({ ...withDamage({ dice: "3d6" }), level: 1 }, 9)).toBe("3d6");
  });
  it("sin daño: null", () => {
    expect(spellDamageAt(withDamage(), 5)).toBeNull();
  });
});
