import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import { derive } from "@/lib/rules/dnd2024/derive";
import { B, buildCatalog, ref } from "../dnd2024/fixtureCatalog";

const OWNER = "a00000000000000000000001";
const DM = "a00000000000000000000002";
const CHAR = "b00000000000000000000001";

const db = await vi.hoisted(async () => (await import("./fakeDb")).createFakeDb());
const state = vi.hoisted(() => ({ found: null as null | Record<string, unknown> }));

vi.mock("@/lib/models/mongodb", () => ({ connectDB: async () => {} }));
vi.doMock("@/lib/models/Character", () => ({ Character: db.model("Character") }));
vi.mock("@/lib/server/characters/characterAccess", () => ({
  OUTDATED_SHEET_ERROR: "antigua",
  // Solo el dueño puede escribir
  loadCharacterFor: async (userId: string) => (userId === OWNER ? state.found : null),
}));
vi.mock("@/lib/server/catalog/catalog", () => ({
  getEntries: async () => [], getEntry: async () => null, resolveRef: async () => null,
}));

const { applyStatusOperation } = await import("@/lib/server/characters/sheetEdits");

const entries = buildCatalog(["class-fighter.json"]);
const SECOND_WIND = `${B}:classFeature:second wind|fighter|xphb|1`;

function sheetOf(extra: Partial<Dnd2024SheetV2> = {}): Dnd2024SheetV2 {
  const fighter = { ref: ref("class:fighter|xphb"), name: "Fighter" };
  return {
    version: 2,
    species: { ref: ref("species:elf|xphb"), name: "Elfo" },
    lineage: null,
    background: { ref: ref("background:none|xphb"), name: "Ninguno", abilities: {}, equipment: "A" },
    abilityMethod: "standard",
    baseAbilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    rolls: null,
    speciesChoices: { skills: [], size: null },
    alignment: "", appearance: "", age: "", languages: "", notes: "", xp: 0,
    hp: { max: null, current: 3, temp: 0 },
    levels: [{ n: 1, class: fighter, classLevel: 1, hp: { method: "average" as const, value: 5 }, choices: [] }],
    classesSummary: [],
    inventory: { items: [], coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, other: "" },
    prepared: {}, spellbookExtra: [], slotsUsed: {}, weaponMasteries: [], hitDiceUsed: {},
    ...extra,
  };
}

const load = (sheet: Dnd2024SheetV2) => {
  state.found = { character: { _id: CHAR, owner: OWNER, sheet }, sheet, entries, books: [B], outdated: false };
};
const set = () => (db.callsOf("Character", "updateOne")[0][1] as { $set: Record<string, unknown> }).$set;

beforeEach(() => {
  db.reset();
  state.found = null;
  db.results["Character.updateOne"] = { matchedCount: 1 };
});

describe("applyStatusOperation", () => {
  it("marca la inspiración heroica y guarda solo ese campo", async () => {
    load(sheetOf());
    const res = await applyStatusOperation(OWNER, CHAR, { op: "inspiration", value: true });
    expect(res).toEqual({ ok: true, status: { heroicInspiration: true, conditions: [], exhaustion: 0, featureUses: {} } });
    expect(set()).toEqual({ "sheet.heroicInspiration": true });
  });

  it("añade un estado y lo guarda", async () => {
    load(sheetOf());
    const res = await applyStatusOperation(OWNER, CHAR, { op: "condition", key: "poisoned", active: true });
    expect(res).toEqual({ ok: true, status: { heroicInspiration: false, conditions: ["poisoned"], exhaustion: 0, featureUses: {} } });
    expect(set()).toEqual({ "sheet.conditions": ["poisoned"] });
  });

  it("guarda el nivel de agotamiento", async () => {
    load(sheetOf());
    const res = await applyStatusOperation(OWNER, CHAR, { op: "exhaustion", level: 3 });
    expect(res).toEqual({ ok: true, status: { heroicInspiration: false, conditions: [], exhaustion: 3, featureUses: {} } });
    expect(set()).toEqual({ "sheet.exhaustion": 3 });
  });

  it("marca un uso de un rasgo y guarda solo featureUses", async () => {
    load(sheetOf());
    const res = await applyStatusOperation(OWNER, CHAR, { op: "featureUse", key: SECOND_WIND, used: 1 });
    expect(res).toMatchObject({ ok: true, status: { featureUses: { [SECOND_WIND]: 1 } } });
    expect(set()).toEqual({ "sheet.featureUses": { [SECOND_WIND]: 1 } });
  });

  it("un uso fuera de rango o de un rasgo sin contador: 400 y no escribe", async () => {
    load(sheetOf());
    const max = derive(sheetOf(), entries).featureUses.find((u) => u.key === SECOND_WIND)!.max;
    expect(await applyStatusOperation(OWNER, CHAR, { op: "featureUse", key: SECOND_WIND, used: max + 1 })).toEqual({
      ok: false, status: 400, error: `Los usos van de 0 a ${max}.`,
    });
    expect(await applyStatusOperation(OWNER, CHAR, { op: "featureUse", key: "nada", used: 1 })).toEqual({
      ok: false, status: 400, error: "Ese rasgo no tiene usos.",
    });
    expect(db.callsOf("Character", "updateOne")).toEqual([]);
  });

  it("otro usuario no puede marcar usos", async () => {
    load(sheetOf());
    expect(await applyStatusOperation(DM, CHAR, { op: "featureUse", key: SECOND_WIND, used: 1 })).toEqual({
      ok: false, status: 404, error: "Personaje no encontrado.",
    });
    expect(db.callsOf("Character", "updateOne")).toEqual([]);
  });

  it("un usuario que no es el dueño: 404 y no escribe", async () => {
    load(sheetOf());
    expect(await applyStatusOperation(DM, CHAR, { op: "inspiration", value: true })).toEqual({
      ok: false, status: 404, error: "Personaje no encontrado.",
    });
    expect(db.callsOf("Character", "updateOne")).toEqual([]);
  });

  it("operación no válida: 400 con el mensaje de las reglas", async () => {
    load(sheetOf());
    expect(await applyStatusOperation(OWNER, CHAR, { op: "condition", key: "volar", active: true })).toEqual({
      ok: false, status: 400, error: "Estado desconocido.",
    });
    expect(db.callsOf("Character", "updateOne")).toEqual([]);
  });

  it("si la hoja cambia a la vez en todos los intentos: 409", async () => {
    load(sheetOf());
    db.results["Character.updateOne"] = { matchedCount: 0 };
    expect(await applyStatusOperation(OWNER, CHAR, { op: "exhaustion", level: 1 })).toEqual({
      ok: false, status: 409, error: "La ficha ha cambiado; recarga la página.",
    });
    expect(db.callsOf("Character", "updateOne")).toHaveLength(3);
  });
});
