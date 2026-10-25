import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dnd2024Sheet, Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet";
import { refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import { B, buildCatalog, ref } from "../dnd2024/fixtureCatalog";

const USER = "a00000000000000000000001";
const OTHER = "a00000000000000000000002";
const BOOK_X = "d00000000000000000000002";

// Catálogo de prueba (todo en el libro B) y nombres de libros falsos; se cuentan las búsquedas de libros
const catalog = buildCatalog();
const db = vi.hoisted(() => ({ bookQueries: 0, missing: new Set<string>() }));
vi.mock("@/lib/rules/catalog", () => ({
  getEntry: async (r: { book: string; key: string }) =>
    db.missing.has(r.key) ? null : (catalog.get(refKey(r)) ?? null),
}));
vi.mock("@/lib/characterAccess", () => ({ OUTDATED_SHEET_ERROR: "antigua" }));
vi.mock("@/lib/models/Book", () => ({
  Book: {
    find: () => {
      db.bookQueries++;
      return { select: () => ({ lean: async () => [{ _id: BOOK_X, name: "Libro X" }] }) };
    },
  },
}));

const { joinReasons, storedSheetBooks } = await import("@/lib/campaignEligibility");

const v1 = (): Dnd2024Sheet => ({
  version: 1,
  species: { ref: { book: BOOK_X, key: "species:elf|xphb" }, name: "Elfo" },
  lineage: null,
  background: { ref: ref("background:acolyte|xphb"), name: "Acólito", abilities: { wis: 2, int: 1 }, equipment: "A" },
  classes: [{
    ref: ref("class:barbarian|xphb"), name: "Bárbaro", level: 1, subclass: null,
    skills: ["athletics", "intimidation"], equipment: "A",
  }],
  abilityMethod: "standard",
  baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  rolls: null,
  speciesChoices: { skills: [], size: null },
  alignment: "", appearance: "", age: "", languages: "", notes: "", xp: 0,
  hp: { max: null, current: null, temp: 0 },
});

const v2 = (speciesBook: string) =>
  ({
    version: 2,
    species: { ref: { book: speciesBook, key: "species:elf|xphb" }, name: "Elfo" },
    lineage: null,
    background: { ref: ref("background:acolyte|xphb"), name: "Acólito" },
    levels: [],
    inventory: { items: [], coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, other: "" },
    prepared: {},
    spellbookExtra: [],
    weaponMasteries: [],
  }) as unknown as Dnd2024SheetV2;

const campaign = (over: Record<string, unknown> = {}) => ({
  owner: OTHER,
  members: [OTHER, USER],
  systemId: "dnd-2024",
  status: "active",
  characters: { allowed: true, external: true },
  restrictBooks: false,
  allowedBooks: [] as string[],
  ...over,
});

beforeEach(() => {
  db.bookQueries = 0;
  db.missing.clear();
});

describe("storedSheetBooks", () => {
  it("una v1 se convierte en memoria: cuenta la clase, el trasfondo y el equipo inicial", async () => {
    expect((await storedSheetBooks(v1()))?.sort()).toEqual([B, BOOK_X].sort());
  });

  it("una v1 que no se puede convertir (falta su clase) → null", async () => {
    db.missing.add("class:barbarian|xphb");
    expect(await storedSheetBooks(v1())).toBeNull();
  });
});

describe("joinReasons", () => {
  const character = (sheet: unknown) => ({ systemId: "dnd-2024", sheet: sheet as Dnd2024SheetV2 });

  it("puede unirse → null; sin ser miembro → el texto de la regla", async () => {
    expect(await joinReasons(USER, [
      { campaign: campaign(), character: character(v2(B)) },
      { campaign: campaign({ members: [OTHER] }), character: character(v2(B)) },
    ])).toEqual([null, "No eres miembro de esta campaña."]);
  });

  it("libros no permitidos → nombres de una sola búsqueda (o el id si ya no existe)", async () => {
    const restricted = campaign({ restrictBooks: true, allowedBooks: [] });
    expect(await joinReasons(USER, [
      { campaign: restricted, character: character(v2(BOOK_X)) },
      { campaign: campaign({ restrictBooks: true, allowedBooks: [B] }), character: character(v2(BOOK_X)) },
    ])).toEqual([
      `Este personaje usa libros que la campaña no permite: Libro X, ${B}.`,
      "Este personaje usa libros que la campaña no permite: Libro X.",
    ]);
    expect(db.bookQueries).toBe(1);
  });

  it("una v1 que no se puede convertir → el aviso de hoja antigua (si la regla no falla antes)", async () => {
    db.missing.add("class:barbarian|xphb");
    expect(await joinReasons(USER, [
      { campaign: campaign(), character: character(v1()) },
      { campaign: campaign({ status: "inactive" }), character: character(v1()) },
    ])).toEqual(["antigua", "Esta campaña no está activa."]);
  });

  it("una v1 con libros fuera de la campaña se juzga por los de su hoja convertida", async () => {
    expect(await joinReasons(USER, [
      { campaign: campaign({ restrictBooks: true, allowedBooks: [B] }), character: character(v1()) },
    ])).toEqual(["Este personaje usa libros que la campaña no permite: Libro X."]);
  });
});
