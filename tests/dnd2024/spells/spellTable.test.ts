import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { CasterBlock, SpellsSummary } from "@/lib/rules/dnd2024/derive/spells";
import { spellTableRows, timeShort } from "@/lib/rules/dnd2024/spells/spellTable";
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
  blocks: [block], slots: { levels: {}, pact: null }, used: {},
  other: [{ spell: named("spell:misty step|xphb"), origin: "Especie: Tiefling" }],
};
const rows = spellTableRows(summary, entries);
const row = (name: string) => rows.find((r) => r.name === name)!;

describe("spellTableRows", () => {
  it("incluye trucos, preparados, limitados y otros; no el libro sin preparar", () => {
    expect(rows.map((r) => r.name).sort()).toEqual(
      ["Amigos", "Descarga de fuego", "Escudo", "Paso brumoso", "Puerta arcana"]);
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
      nameEn: "spell:shield|xphb", key: `${B}:spell:shield|xphb`, level: 1, school: "Evocación", timeShort: "1R",
    });
    expect(row("Amigos")).toMatchObject({ concentration: true, ritual: false });
  });
});

describe("timeShort", () => {
  it.each([
    ["1 acción", "1A"], ["1 acción adicional", "1AA"], ["1 reacción, que tomas cuando…", "1R"],
    ["10 minutos", "10 min"], ["1 hora", "1 h"], ["8 horas", "8 h"], ["1 minuto", "1 min"], ["Especial", "Especial"],
  ])("%s → %s", (time, short) => expect(timeShort(time)).toBe(short));
});
