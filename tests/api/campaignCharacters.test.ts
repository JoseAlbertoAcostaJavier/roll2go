import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const CAMPAIGN = "c00000000000000000000001";
const CHAR = "b00000000000000000000001";
const DM = "a00000000000000000000002";
const PLAYER = "a00000000000000000000003";

// El DM (o no) de la campaña, el personaje guardado y la base de datos falsos; se registran escrituras y avisos
const db = vi.hoisted(() => ({
  isDm: true,
  character: null as null | Record<string, unknown>,
  matched: 1,
  updates: [] as unknown[][],
  notified: [] as Record<string, unknown>[],
  cleared: [] as unknown[],
}));
vi.mock("@/lib/server/campaigns/campaignApi", () => ({
  requireDm: async () =>
    db.isDm
      ? { session: { id: DM }, campaign: { _id: CAMPAIGN, owner: DM, members: [DM, PLAYER] }, isDm: true }
      : { error: NextResponse.json({ error: "Solo el DM puede hacer esto." }, { status: 403 }) },
}));
vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: async () => ({ ok: true }),
  tooManyRequests: () => new Response(null, { status: 429 }),
}));
vi.mock("@/lib/models/Character", () => ({
  Character: {
    findOne: () => ({ select: () => ({ lean: async () => db.character }) }),
    updateOne: async (...args: unknown[]) => (db.updates.push(args), { matchedCount: db.matched }),
  },
}));
vi.mock("@/lib/server/notifications/notify", () => ({ notify: async (n: Record<string, unknown>) => void db.notified.push(n) }));
vi.mock("@/lib/models/Notification", () => ({
  Notification: { deleteMany: async (filter: unknown) => (db.cleared.push(filter), { deletedCount: 1 }) },
}));

const { POST: approve } = await import("@/app/api/campaigns/[id]/characters/[characterId]/approve/route");
const { POST: reject } = await import("@/app/api/campaigns/[id]/characters/[characterId]/reject/route");
const { DELETE: remove } = await import("@/app/api/campaigns/[id]/characters/[characterId]/route");

type Handler = (req: NextRequest, ctx: { params: Promise<{ id: string; characterId: string }> }) => Promise<Response>;
const call = async (handler: Handler, method = "POST") => {
  const res = await handler(new NextRequest(`http://localhost/api/campaigns/${CAMPAIGN}/characters/${CHAR}`, { method }), {
    params: Promise.resolve({ id: CAMPAIGN, characterId: CHAR }),
  });
  return { status: res.status, json: await res.json() };
};
const unset = { $unset: { campaign: "", origin: "", campaignStatus: "" } };
const pending = { _id: CHAR, name: "Grog", owner: PLAYER, campaignStatus: "pending" };

beforeEach(() => {
  db.isDm = true;
  db.character = { ...pending };
  db.matched = 1;
  db.updates = [];
  db.notified = [];
  db.cleared = [];
});
// Aviso de solicitud que recibió el DM: se borra al resolverse, para que no quede uno caducado
const requestNotice = { type: "character_import_request", character: CHAR, campaign: CAMPAIGN };

describe("POST …/characters/[characterId]/approve", () => {
  it("el DM acepta una solicitud pendiente y avisa al dueño", async () => {
    expect(await call(approve)).toEqual({ status: 200, json: { ok: true } });
    expect(db.updates).toEqual([
      [{ _id: CHAR, campaign: CAMPAIGN, campaignStatus: "pending" }, { $set: { campaignStatus: "approved" } }],
    ]);
    expect(db.notified).toEqual([
      { user: PLAYER, type: "character_approved", actor: DM, campaign: CAMPAIGN, character: CHAR, text: "Grog" },
    ]);
    expect(db.cleared).toEqual([requestNotice]);
  });

  it("no DM → 403", async () => {
    db.isDm = false;
    expect((await call(approve)).status).toBe(403);
    expect(db.updates).toEqual([]);
  });

  it("ya aprobado → 409", async () => {
    db.character = { ...pending, campaignStatus: "approved" };
    expect(await call(approve)).toEqual({ status: 409, json: { error: "La solicitud ya no está pendiente." } });
    expect(db.updates).toEqual([]);
  });

  it("el jugador canceló justo antes (la escritura no coincide) → 409 y sin aviso", async () => {
    db.matched = 0;
    expect(await call(approve)).toEqual({ status: 409, json: { error: "La solicitud ya no está pendiente." } });
    expect(db.notified).toEqual([]);
    expect(db.cleared).toEqual([]);
  });

  it("ya no está en la campaña → 409", async () => {
    db.character = null;
    expect(await call(approve)).toEqual({ status: 409, json: { error: "La solicitud ya no está pendiente." } });
  });
});

describe("POST …/characters/[characterId]/reject", () => {
  it("el DM deniega: sale de la campaña y avisa al dueño", async () => {
    expect(await call(reject)).toEqual({ status: 200, json: { ok: true } });
    expect(db.updates).toEqual([[{ _id: CHAR, campaign: CAMPAIGN, campaignStatus: "pending" }, unset]]);
    expect(db.notified).toEqual([
      { user: PLAYER, type: "character_rejected", actor: DM, campaign: CAMPAIGN, character: CHAR, text: "Grog" },
    ]);
    expect(db.cleared).toEqual([requestNotice]);
  });

  it("no DM → 403", async () => {
    db.isDm = false;
    expect((await call(reject)).status).toBe(403);
  });

  it("no pendiente → 409", async () => {
    db.character = { ...pending, campaignStatus: undefined };
    expect(await call(reject)).toEqual({ status: 409, json: { error: "La solicitud ya no está pendiente." } });
    db.character = { ...pending };
    db.matched = 0;
    expect(await call(reject)).toEqual({ status: 409, json: { error: "La solicitud ya no está pendiente." } });
    expect(db.notified).toEqual([]);
  });
});

describe("DELETE /api/campaigns/[id]/characters/[characterId]", () => {
  it("el DM quita un personaje aprobado: $unset y aviso character_removed al dueño", async () => {
    db.character = { ...pending, campaignStatus: "approved" };
    expect(await call(remove, "DELETE")).toEqual({ status: 200, json: { ok: true } });
    expect(db.updates).toEqual([[{ _id: CHAR, campaign: CAMPAIGN }, unset]]);
    expect(db.notified).toEqual([
      { user: PLAYER, type: "character_removed", actor: DM, campaign: CAMPAIGN, character: CHAR, text: "Grog" },
    ]);
    expect(db.cleared).toEqual([]);
  });

  it("también uno pendiente (y se borra el aviso de su solicitud)", async () => {
    expect((await call(remove, "DELETE")).status).toBe(200);
    expect(db.notified.map((n) => n.type)).toEqual(["character_removed"]);
    expect(db.cleared).toEqual([requestNotice]);
  });

  it("su propio personaje: sin aviso", async () => {
    db.character = { ...pending, owner: DM, campaignStatus: "approved" };
    expect((await call(remove, "DELETE")).status).toBe(200);
    expect(db.notified).toEqual([]);
  });

  it("no DM → 403", async () => {
    db.isDm = false;
    expect((await call(remove, "DELETE")).status).toBe(403);
  });

  it("no está en la campaña → 404", async () => {
    db.character = null;
    expect(await call(remove, "DELETE")).toEqual({ status: 404, json: { error: "Personaje no encontrado." } });
    db.character = { ...pending };
    db.matched = 0;
    expect((await call(remove, "DELETE")).status).toBe(404);
    expect(db.notified).toEqual([]);
  });
});
