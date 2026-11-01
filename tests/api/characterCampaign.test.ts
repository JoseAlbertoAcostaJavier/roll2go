import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";

const CAMPAIGN = "c00000000000000000000001";
const OTHER_CAMPAIGN = "c00000000000000000000002";
const CHAR = "b00000000000000000000001";
const DM = "a00000000000000000000002";
const PLAYER = "a00000000000000000000003";
const BOOK_OK = "d00000000000000000000001";
const BOOK_X = "d00000000000000000000002";
const BOOK_Y = "d00000000000000000000003";

// Hoja con referencias a dos libros (la especie y el trasfondo); Character.books está vacío
const sheetUsing = (speciesBook: string, backgroundBook: string) =>
  ({
    version: 2,
    species: { ref: { book: speciesBook, key: "species:elf|xphb" }, name: "Elfo" },
    lineage: null,
    background: { ref: { book: backgroundBook, key: "background:sage|xphb" }, name: "Sabio" },
    levels: [],
    inventory: { items: [], coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, other: "" },
    prepared: {},
    spellbookExtra: [],
    weaponMasteries: [],
    hitDiceUsed: {},
  }) as unknown as Dnd2024SheetV2;

// Sesión, acceso, campaña, libros y base de datos falsos; se registran las escrituras y los avisos
const db = vi.hoisted(() => ({
  session: { id: "" } as { id: string } | null,
  found: null as null | { character: Record<string, unknown>; sheet: unknown; outdated: boolean },
  campaign: null as null | Record<string, unknown>,
  owned: null as null | Record<string, unknown>,
  matched: 1,
  updates: [] as unknown[][],
  notified: [] as Record<string, unknown>[],
  cleared: [] as unknown[],
}));
const lean = (v: unknown) => ({ select: () => ({ lean: async () => v }) });
vi.mock("@/lib/server/campaigns/campaignApi", () => ({ sessionOf: async () => db.session }));
vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: async () => ({ ok: true }),
  tooManyRequests: () => new Response(null, { status: 429 }),
}));
vi.mock("@/lib/models/mongodb", () => ({ connectDB: async () => {} }));
vi.mock("@/lib/server/characters/characterAccess", () => ({
  OUTDATED_SHEET_ERROR: "antigua",
  loadCharacterFor: async () => db.found,
}));
vi.mock("@/lib/models/Campaign", () => ({
  Campaign: { findById: (id: string) => lean(db.campaign && String(db.campaign._id) === String(id) ? db.campaign : null) },
}));
vi.mock("@/lib/models/Book", () => ({
  Book: {
    find: () =>
      lean([
        { _id: BOOK_X, name: "Libro X" },
        { _id: BOOK_Y, name: "Libro Y" },
      ]),
  },
}));
vi.mock("@/lib/models/Character", () => ({
  Character: {
    findOne: () => lean(db.owned),
    updateOne: async (...args: unknown[]) => (db.updates.push(args), { matchedCount: db.matched }),
  },
}));
vi.mock("@/lib/server/notifications/notify", () => ({ notify: async (n: Record<string, unknown>) => void db.notified.push(n) }));
vi.mock("@/lib/models/Notification", () => ({
  Notification: { deleteMany: async (filter: unknown) => (db.cleared.push(filter), { deletedCount: 1 }) },
}));

const { POST, DELETE } = await import("@/app/api/characters/[id]/campaign/route");

const params = { params: Promise.resolve({ id: CHAR }) };
const request = async (campaignId: string) => {
  const res = await POST(
    new NextRequest(`http://localhost/api/characters/${CHAR}/campaign`, {
      method: "POST",
      body: JSON.stringify({ campaignId }),
    }),
    params,
  );
  return { status: res.status, json: await res.json() };
};
const leave = async () => {
  const res = await DELETE(new NextRequest(`http://localhost/api/characters/${CHAR}/campaign`, { method: "DELETE" }), params);
  return { status: res.status, json: await res.json() };
};

const campaign = (over: Record<string, unknown> = {}) => ({
  _id: CAMPAIGN,
  name: "Mesa",
  owner: DM,
  members: [DM, PLAYER],
  systemId: "dnd-2024",
  status: "active",
  characters: { allowed: true, internal: true, external: true },
  restrictBooks: false,
  allowedBooks: [],
  ...over,
});

beforeEach(() => {
  db.session = { id: PLAYER };
  db.found = {
    character: { _id: CHAR, name: "Grog", owner: PLAYER, systemId: "dnd-2024", books: [] },
    sheet: sheetUsing(BOOK_OK, BOOK_OK),
    outdated: false,
  };
  db.campaign = campaign();
  db.owned = null;
  db.matched = 1;
  db.updates = [];
  db.notified = [];
  db.cleared = [];
});

describe("POST /api/characters/[id]/campaign", () => {
  it("un jugador solicita: queda pendiente con escritura condicional y avisa al DM", async () => {
    expect(await request(CAMPAIGN)).toEqual({ status: 200, json: { status: "pending" } });
    expect(db.updates).toEqual([
      [
        { _id: CHAR, owner: PLAYER, campaign: { $exists: false } },
        { $set: { campaign: CAMPAIGN, origin: "external", campaignStatus: "pending" } },
      ],
    ]);
    expect(db.notified).toEqual([
      { user: DM, type: "character_import_request", actor: PLAYER, campaign: CAMPAIGN, character: CHAR, text: "Grog" },
    ]);
  });

  it("el DM añade un personaje suyo: aprobado al momento y sin aviso", async () => {
    db.session = { id: DM };
    db.found!.character.owner = DM;
    expect(await request(CAMPAIGN)).toEqual({ status: 200, json: { status: "approved" } });
    expect(db.updates[0][0]).toEqual({ _id: CHAR, owner: DM, campaign: { $exists: false } });
    expect(db.updates[0][1]).toEqual({ $set: { campaign: CAMPAIGN, origin: "external", campaignStatus: "approved" } });
    expect(db.notified).toEqual([]);
  });

  it("si la regla falla → 400 con su texto y sin escribir", async () => {
    db.campaign = campaign({ characters: { allowed: true, internal: true, external: false } });
    expect(await request(CAMPAIGN)).toEqual({
      status: 400,
      json: { error: "Esta campaña no admite personajes creados fuera de ella." },
    });
    expect(db.updates).toEqual([]);
  });

  it("no miembro → 400", async () => {
    db.campaign = campaign({ members: [DM] });
    expect(await request(CAMPAIGN)).toEqual({ status: 400, json: { error: "No eres miembro de esta campaña." } });
  });

  it("libros: se juzga por los que usa la hoja (Character.books vacío) y se nombran los no permitidos", async () => {
    db.found!.sheet = sheetUsing(BOOK_X, BOOK_Y);
    db.campaign = campaign({ restrictBooks: true, allowedBooks: [BOOK_OK] });
    expect(await request(CAMPAIGN)).toEqual({
      status: 400,
      json: { error: "Este personaje usa libros que la campaña no permite: Libro X, Libro Y." },
    });
    expect(db.updates).toEqual([]);
  });

  it("libros permitidos por la hoja → se acepta aunque Character.books esté vacío", async () => {
    db.campaign = campaign({ restrictBooks: true, allowedBooks: [BOOK_OK] });
    expect(await request(CAMPAIGN)).toEqual({ status: 200, json: { status: "pending" } });
  });

  it("la escritura condicional no coincide (otra solicitud se adelantó) → 409", async () => {
    db.matched = 0;
    expect(await request(CAMPAIGN)).toEqual({ status: 409, json: { error: "Este personaje ya está en una campaña." } });
    expect(db.notified).toEqual([]);
  });

  it("ya en otra campaña → 400 de la regla", async () => {
    db.found!.character.campaign = OTHER_CAMPAIGN;
    expect(await request(CAMPAIGN)).toEqual({ status: 400, json: { error: "Este personaje ya está en una campaña." } });
  });

  it("hoja antigua → 409", async () => {
    db.found!.outdated = true;
    expect(await request(CAMPAIGN)).toEqual({ status: 409, json: { error: "antigua" } });
  });

  it("personaje ajeno o inexistente → 404; campaña inexistente → 404", async () => {
    db.found = null;
    expect((await request(CAMPAIGN)).status).toBe(404);
    db.found = { character: { _id: CHAR, name: "Grog", owner: PLAYER, systemId: "dnd-2024" }, sheet: sheetUsing(BOOK_OK, BOOK_OK), outdated: false };
    expect(await request(OTHER_CAMPAIGN)).toEqual({ status: 404, json: { error: "Campaña no encontrada." } });
  });

  it("sin sesión → 401", async () => {
    db.session = null;
    expect((await request(CAMPAIGN)).status).toBe(401);
  });
});

describe("DELETE /api/characters/[id]/campaign", () => {
  const unset = { $unset: { campaign: "", origin: "", campaignStatus: "" } };

  it("cancelar una solicitud pendiente: sin aviso, y se borra el que recibió el DM", async () => {
    db.owned = { _id: CHAR, name: "Grog", owner: PLAYER, campaign: CAMPAIGN, campaignStatus: "pending" };
    expect(await leave()).toEqual({ status: 200, json: { ok: true } });
    expect(db.updates).toEqual([[{ _id: CHAR, owner: PLAYER, campaign: CAMPAIGN, campaignStatus: "pending" }, unset]]);
    expect(db.notified).toEqual([]);
    expect(db.cleared).toEqual([{ type: "character_import_request", character: CHAR, campaign: CAMPAIGN }]);
  });

  it("sacar un personaje aprobado de un jugador: avisa al DM con character_left", async () => {
    db.owned = { _id: CHAR, name: "Grog", owner: PLAYER, campaign: CAMPAIGN, campaignStatus: "approved" };
    expect(await leave()).toEqual({ status: 200, json: { ok: true } });
    expect(db.updates).toEqual([
      [{ _id: CHAR, owner: PLAYER, campaign: CAMPAIGN, campaignStatus: { $ne: "pending" } }, unset],
    ]);
    expect(db.notified).toEqual([
      { user: DM, type: "character_left", actor: PLAYER, campaign: CAMPAIGN, character: CHAR, text: "Grog" },
    ]);
    expect(db.cleared).toEqual([]);
  });

  it("un personaje antiguo sin campaignStatus cuenta como aprobado", async () => {
    db.owned = { _id: CHAR, name: "Grog", owner: PLAYER, campaign: CAMPAIGN };
    expect((await leave()).status).toBe(200);
    expect(db.notified.map((n) => n.type)).toEqual(["character_left"]);
  });

  it("el DM saca su propio personaje: sin aviso", async () => {
    db.session = { id: DM };
    db.owned = { _id: CHAR, name: "Grog", owner: DM, campaign: CAMPAIGN, campaignStatus: "approved" };
    expect((await leave()).status).toBe(200);
    expect(db.notified).toEqual([]);
  });

  it("no dueño (o no existe) → 404", async () => {
    db.owned = null;
    expect(await leave()).toEqual({ status: 404, json: { error: "Personaje no encontrado." } });
    expect(db.updates).toEqual([]);
  });

  it("sin campaña → 409", async () => {
    db.owned = { _id: CHAR, name: "Grog", owner: PLAYER };
    expect(await leave()).toEqual({ status: 409, json: { error: "Este personaje no está en ninguna campaña." } });
  });

  it("cambió entretanto (la escritura no coincide) → 409 y sin aviso", async () => {
    db.owned = { _id: CHAR, name: "Grog", owner: PLAYER, campaign: CAMPAIGN, campaignStatus: "approved" };
    db.matched = 0;
    expect(await leave()).toEqual({ status: 409, json: { error: "El personaje ha cambiado; recarga la página." } });
    expect(db.notified).toEqual([]);
    expect(db.cleared).toEqual([]);
  });
});
