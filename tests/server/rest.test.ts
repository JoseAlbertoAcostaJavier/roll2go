import { beforeEach, describe, expect, it, vi } from "vitest";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import { B, buildCatalog, ref } from "../dnd2024/fixtureCatalog";

const OWNER = "a00000000000000000000001";
const DM = "a00000000000000000000002";
const CHAR = "b00000000000000000000001";

const db = await vi.hoisted(async () => (await import("./fakeDb")).createFakeDb());
const state = vi.hoisted(() => ({ found: null as null | Record<string, unknown> }));

vi.mock("@/lib/models/mongodb", () => ({ connectDB: async () => {} }));
vi.doMock("@/lib/models/Character", () => ({ Character: db.model("Character") }));
// Tirada fija: siempre un 4
vi.mock("node:crypto", async (orig) => ({ ...(await orig<typeof import("node:crypto")>()), randomInt: () => 4 }));
vi.mock("@/lib/server/characters/characterAccess", () => ({
  OUTDATED_SHEET_ERROR: "antigua",
  // Solo el dueño puede escribir
  loadCharacterFor: async (userId: string) => (userId === OWNER ? state.found : null),
}));
vi.mock("@/lib/server/catalog/catalog", () => ({
  getEntries: async () => [], getEntry: async () => null, resolveRef: async () => null,
}));

const { applyRestOperation } = await import("@/lib/server/characters/sheetEdits");

const entries = buildCatalog(["class-fighter.json"]);
const FIGHTER = refKey(ref("class:fighter|xphb"));

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
    levels: [1, 2, 3].map((n) => ({ n, class: fighter, classLevel: n, hp: { method: "average" as const, value: 5 }, choices: [] })),
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

describe("applyRestOperation", () => {
  it("descanso corto con 1 dado: guarda PG y dados gastados, con la tirada del servidor", async () => {
    load(sheetOf());
    const res = await applyRestOperation(OWNER, CHAR, { op: "shortRest", spend: { [FIGHTER]: 1 } });
    expect(res).toEqual({ ok: true, healed: 6, rolls: [4] }); // 4 + 2 (Con 14)
    expect(set()["sheet.hp"]).toEqual({ max: null, current: 9, temp: 0 });
    expect(set()["sheet.hitDiceUsed"]).toEqual({ [FIGHTER]: 1 });
  });

  it("un usuario que no es el dueño: 404 y no escribe", async () => {
    load(sheetOf());
    expect(await applyRestOperation(DM, CHAR, { op: "longRest" })).toEqual({
      ok: false, status: 404, error: "Personaje no encontrado.",
    });
    expect(db.callsOf("Character", "updateOne")).toEqual([]);
  });

  it("descanso largo: deja los dados gastados a cero", async () => {
    load(sheetOf({ hitDiceUsed: { [FIGHTER]: 2 } }));
    expect(await applyRestOperation(OWNER, CHAR, { op: "longRest" })).toEqual({ ok: true, healed: 0, rolls: [] });
    expect(set()["sheet.hitDiceUsed"]).toEqual({});
  });

  it("descanso largo: baja en 1 el agotamiento guardado", async () => {
    load(sheetOf({ exhaustion: 2 }));
    expect(await applyRestOperation(OWNER, CHAR, { op: "longRest" })).toEqual({ ok: true, healed: 0, rolls: [] });
    expect(set()["sheet.exhaustion"]).toBe(1);
  });

  it("descanso largo: una hoja sin agotamiento no gana el campo", async () => {
    load(sheetOf());
    await applyRestOperation(OWNER, CHAR, { op: "longRest" });
    expect(Object.keys(set())).not.toContain("sheet.exhaustion");
  });

  it("operación no válida: 400", async () => {
    load(sheetOf());
    expect(await applyRestOperation(OWNER, CHAR, { op: "volar" })).toEqual({ ok: false, status: 400, error: "Operación no válida." });
  });
});
