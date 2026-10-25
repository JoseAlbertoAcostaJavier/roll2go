import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Dnd2024SheetV2, LevelEntry } from "@/lib/rules/dnd2024/sheet";
import { B, buildCatalog, ref } from "../dnd2024/fixtureCatalog";

const catalog = buildCatalog(["class-cleric.json"]);
const cleric = { ref: ref("class:cleric|xphb"), name: "Clérigo" };
const levels: LevelEntry[] = [1, 2].map((n) => ({ n, class: cleric, classLevel: n, hp: { method: "average", value: 5 }, choices: [] }));
const sheet = {
  version: 2,
  species: { ref: ref("species:elf|xphb"), name: "Elfo" },
  lineage: null,
  background: { ref: ref("background:none|xphb"), name: "Ninguno", abilities: {}, equipment: "A" },
  abilityMethod: "standard",
  baseAbilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
  rolls: null,
  speciesChoices: { skills: [], size: null },
  alignment: "", appearance: "", age: "", languages: "", notes: "", xp: 0,
  hp: { max: null, current: null, temp: 0 },
  levels,
  classesSummary: [],
  inventory: { items: [], coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, other: "" },
  prepared: { "class:cleric|xphb": [ref("spell:bless|xphb")] },
  spellbookExtra: [],
  slotsUsed: { 1: 1 },
  weaponMasteries: [],
} as Dnd2024SheetV2;

// Sesión, acceso, catálogo y base de datos falsos: la escritura condicional siempre falla y `exists` dice si el
// personaje sigue en el mismo nivel
const db = vi.hoisted(() => ({ sameLevel: true, sheet: null as unknown, updates: [] as unknown[] }));
vi.mock("@/lib/server/campaigns/campaignApi", () => ({ sessionOf: async () => ({ id: "u1" }) }));
vi.mock("@/lib/utils/rateLimit", () => ({
  rateLimit: async () => ({ ok: true }),
  tooManyRequests: () => new Response(null, { status: 429 }),
}));
vi.mock("@/lib/server/characters/characterAccess", () => ({
  OUTDATED_SHEET_ERROR: "antigua",
  loadCharacterFor: async () => {
    const current = (db.sheet ?? sheet) as Dnd2024SheetV2;
    return { character: { sheet: current }, sheet: current, books: [B], entries: catalog, outdated: false };
  },
}));
vi.mock("@/lib/server/catalog/catalog", () => ({ getEntries: async () => [] }));
vi.mock("@/lib/rules/dnd2024/sheetEntries", () => ({ loadSheetEntries: async () => catalog }));
vi.mock("@/lib/models/Character", () => ({
  Character: {
    updateOne: async (...args: unknown[]) => {
      db.updates.push(args);
      return { matchedCount: 0 };
    },
    exists: async () => (db.sameLevel ? { _id: "c1" } : null),
  },
}));

const { DELETE } = await import("@/app/api/characters/[id]/levels/last/route");

const remove = async () => {
  const res = await DELETE(new NextRequest("http://localhost/api/characters/c1/levels/last", { method: "DELETE" }), {
    params: Promise.resolve({ id: "c1" }),
  });
  return { status: res.status, json: await res.json() };
};

describe("DELETE /api/characters/[id]/levels/last: conflictos", () => {
  it("si cambió el nivel → 409 de nivel", async () => {
    db.sameLevel = false;
    expect(await remove()).toEqual({ status: 409, json: { error: "El personaje ha cambiado de nivel; recarga la página." } });
  });
  it("si cambiaron los conjuros (mismo nivel) → 409 propio", async () => {
    db.sameLevel = true;
    expect(await remove()).toEqual({
      status: 409, json: { error: "El personaje ha cambiado mientras borrabas el nivel. Recarga la página." },
    });
  });
});

describe("DELETE /api/characters/[id]/levels/last: alternativa de conjuros", () => {
  it("al borrar el nivel que dio la subclase, quita su alternativa (si nadie la ha cambiado entretanto)", async () => {
    const life = ref("subclass:life domain|cleric|xphb");
    const three: LevelEntry[] = [...levels, {
      n: 3, class: cleric, classLevel: 3, hp: { method: "average", value: 5 },
      choices: [{ type: "subclass", source: "class:subclass", value: { ref: life, name: "Vida" } }],
    }];
    db.sheet = { ...sheet, levels: three, spellOption: { [life.key]: "Opción", otra: "Otra" } };
    db.updates = [];
    await remove();
    const [filter, update] = db.updates[0] as [Record<string, unknown>, { $set: Record<string, unknown> }];
    expect(update.$set["sheet.spellOption"]).toEqual({ otra: "Otra" });
    expect(filter).toHaveProperty(["sheet.spellOption"]);
    db.sheet = null;
  });
});
