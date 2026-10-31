import { beforeEach, describe, expect, it, vi } from "vitest";

const ME = "a00000000000000000000001";
const OTHER = "a00000000000000000000002";
const CAMPAIGN = "c00000000000000000000001";
const INVITE = "f00000000000000000000001";
const PAIR = `${ME}:${OTHER}`;

const db = await vi.hoisted(async () => (await import("./fakeDb")).createFakeDb());
const state = vi.hoisted(() => ({
  notified: [] as Record<string, unknown>[],
  target: null as null | Record<string, unknown>,
  relation: "friend",
  block: { byMe: false, byThem: false, any: false },
}));

vi.mock("@/lib/models/mongodb", () => ({ connectDB: async () => {} }));
for (const name of ["Block", "CampaignInvite", "Message", "Notification", "User", "Campaign"]) {
  vi.doMock(`@/lib/models/${name}`, () => ({ [name]: db.model(name) }));
}
vi.mock("@/lib/models/Friendship", () => ({
  Friendship: db.model("Friendship"),
  pairKey: (a: string, b: string) => [a, b].sort().join(":"),
}));
vi.mock("@/lib/server/social/friends", () => ({
  findUserByUsername: async () => state.target,
  relationBetween: async () => state.relation,
  relationOf: () => "friend",
  relationsWith: async () => new Map([[OTHER, "outgoing"]]),
}));
vi.mock("@/lib/server/social/blocks", () => ({
  blockStatus: async () => state.block,
  blockedIdsOf: async () => ["bloqueado"],
}));
vi.mock("@/lib/server/notifications/notify", () => ({ notify: async (n: Record<string, unknown>) => void state.notified.push(n) }));
vi.mock("@/lib/server/account/userCards", () => ({ loadUserCards: async () => new Map() }));

const relations = await import("@/lib/server/social/relations");
const messages = await import("@/lib/server/social/messages");
const { searchUsers } = await import("@/lib/server/social/queries");
const { answerInvite, loadInviteLanding } = await import("@/lib/server/campaigns/joinCampaign");

const other = { _id: OTHER, username: "luis", displayName: "", avatarId: null };

beforeEach(() => {
  db.reset();
  state.notified = [];
  state.target = other;
  state.relation = "friend";
  state.block = { byMe: false, byThem: false, any: false };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("amistades y bloqueos", () => {
  it("solicitud a alguien que no existe (404) o a uno mismo (400)", async () => {
    state.target = null;
    expect(await relations.sendFriendRequest(ME, "nadie")).toEqual({
      ok: false, status: 404, error: "No existe ningún usuario con ese nombre.",
    });
    state.target = { ...other, _id: ME };
    expect(await relations.sendFriendRequest(ME, "yo")).toEqual({
      ok: false, status: 400, error: "No puedes enviarte una solicitud a ti mismo.",
    });
  });

  it("solicitud a quien has bloqueado o a quien te ha bloqueado: 403 y no se crea", async () => {
    state.target = other;
    state.block = { byMe: true, byThem: false, any: true };
    expect(await relations.sendFriendRequest(ME, "luis")).toEqual({
      ok: false, status: 403, error: "Has bloqueado a este usuario. Desbloquéalo para poder enviarle una solicitud.",
    });
    state.block = { byMe: false, byThem: true, any: true };
    expect(await relations.sendFriendRequest(ME, "luis")).toEqual({
      ok: false, status: 403, error: "No puedes enviar una solicitud a este usuario.",
    });
    expect(db.callsOf("Friendship", "create")).toEqual([]);
  });

  it("solicitud cruzada: se acepta la que ya había y se avisa", async () => {
    const existing = { status: "pending", requester: OTHER, save: vi.fn(async () => {}) };
    db.results["Friendship.findOne"] = existing;
    expect(await relations.sendFriendRequest(ME, "luis")).toEqual({ ok: true, relation: "friend" });
    expect(existing.status).toBe("accepted");
    expect(state.notified).toEqual([{ user: OTHER, type: "friend_accepted", actor: ME }]);
  });

  it("solicitud nueva: queda pendiente y se avisa; con demasiadas pendientes, 400", async () => {
    db.results["Friendship.findOne"] = null;
    db.results["Friendship.countDocuments"] = 50;
    expect(await relations.sendFriendRequest(ME, "luis")).toMatchObject({ ok: false, status: 400 });
    db.results["Friendship.countDocuments"] = 0;
    expect(await relations.sendFriendRequest(ME, "luis")).toEqual({ ok: true, relation: "outgoing" });
    expect(db.callsOf("Friendship", "create")[0][0]).toEqual({ requester: ME, recipient: OTHER, pair: PAIR });
  });

  it("responder sin solicitud pendiente: 404; rechazarla la borra", async () => {
    db.results["Friendship.findOne"] = null;
    expect(await relations.answerFriendRequest(ME, "luis", "accept")).toEqual({
      ok: false, status: 404, error: "No hay ninguna solicitud pendiente de este usuario.",
    });
    const f = { deleteOne: vi.fn(async () => {}) };
    db.results["Friendship.findOne"] = f;
    expect(await relations.answerFriendRequest(ME, "luis", "decline")).toEqual({ ok: true, relation: "none" });
    expect(f.deleteOne).toHaveBeenCalled();
  });

  it("eliminar sin relación: 404", async () => {
    db.results["Friendship.deleteOne"] = { deletedCount: 0 };
    expect(await relations.removeFriend(ME, "luis")).toEqual({
      ok: false, status: 404, error: "No hay ninguna relación con este usuario.",
    });
  });

  it("bloquear rompe la amistad; bloquearse a uno mismo, 400", async () => {
    expect(await relations.blockUser(ME, "luis")).toEqual({ ok: true });
    expect(db.callsOf("Friendship", "deleteOne")[0][0]).toEqual({ pair: PAIR });
    state.target = { ...other, _id: ME };
    expect(await relations.blockUser(ME, "yo")).toEqual({ ok: false, status: 400, error: "No puedes bloquearte a ti mismo." });
  });
});

describe("mensajes", () => {
  it("solo a amigos y sin bloqueos", async () => {
    state.block = { byMe: false, byThem: true, any: true };
    expect(await messages.sendMessage(ME, "luis", "hola")).toEqual({
      ok: false, status: 403, error: "No puedes enviar mensajes a este usuario.",
    });
    state.block = { byMe: false, byThem: false, any: false };
    state.relation = "none";
    expect(await messages.sendMessage(ME, "luis", "hola")).toEqual({ ok: false, status: 403, error: "Solo puedes escribir a tus amigos." });
  });

  it("enviar crea el mensaje, avisa y lo devuelve como propio", async () => {
    db.results["Message.create"] = { _id: "m1", from: ME, text: "hola", createdAt: new Date(0) };
    expect(await messages.sendMessage(ME, "luis", "hola")).toEqual({
      ok: true, message: { id: "m1", mine: true, text: "hola", createdAt: new Date(0).toISOString() },
    });
    expect(state.notified).toEqual([{ user: OTHER, type: "message", actor: ME, quote: "hola" }]);
  });

  it("al abrir la conversación, lo recibido pasa a leído", async () => {
    db.results["Message.find"] = [{ _id: "m1", from: OTHER, text: "hola", createdAt: new Date(0) }];
    db.results["Message.findOne"] = { _id: "m0" };
    const r = await messages.loadConversation(ME, "luis", null);
    expect(r).toMatchObject({ ok: true, canSend: true, myLastReadId: "m0", messages: [{ id: "m1", mine: false }] });
    expect(db.callsOf("Message", "updateMany")[0][0]).toEqual({ pair: PAIR, to: ME, readAt: null });
  });

  it("página de una conversación: no existe, eres tú o no hay nada que ver", async () => {
    state.target = null;
    expect(await messages.loadConversationPage(ME, "nadie")).toEqual({ status: "missing" });
    state.target = { ...other, _id: ME };
    expect(await messages.loadConversationPage(ME, "yo")).toEqual({ status: "self" });
    state.target = other;
    state.relation = "none";
    db.results["Message.find"] = [];
    expect(await messages.loadConversationPage(ME, "luis")).toEqual({ status: "nothing", username: "luis" });
  });

  it("la lista cuenta las conversaciones con cuentas borradas pero no las muestra", async () => {
    db.results["Message.aggregate"] = [{ _id: PAIR, last: { from: OTHER, to: ME, text: "hola" }, unread: 2 }];
    db.results["User.find"] = [];
    expect(await messages.listConversations(ME)).toEqual({ total: 1, conversations: [] });
  });
});

describe("buscador e invitaciones", () => {
  it("la búsqueda excluye a uno mismo y a los bloqueados, con la relación de cada uno", async () => {
    db.results["User.find"] = [other];
    expect(await searchUsers(ME, "lu")).toEqual({
      ok: true, users: [{ username: "luis", displayName: "luis", avatarUrl: null, relation: "outgoing" }],
    });
    expect(db.callsOf("User", "find")[0][0]).toMatchObject({ verified: true, _id: { $nin: [ME, "bloqueado"] } });
  });

  it("responder a una invitación que no es tuya: 404; rechazarla borra la invitación y su aviso", async () => {
    expect(await answerInvite(ME, "x", "accept")).toEqual({ ok: false, status: 404, error: "La invitación ya no existe." });
    const invite = { campaign: CAMPAIGN, deleteOne: vi.fn(async () => {}) };
    db.results["CampaignInvite.findOne"] = invite;
    expect(await answerInvite(ME, INVITE, "decline")).toEqual({ ok: true });
    expect(invite.deleteOne).toHaveBeenCalled();
    expect(db.callsOf("Notification", "deleteMany")[0][0]).toEqual({ user: ME, type: "campaign_invite", campaign: CAMPAIGN });
  });

  it("aceptar una invitación a una campaña llena: 409 y la invitación sigue", async () => {
    const invite = { campaign: CAMPAIGN, deleteOne: vi.fn(async () => {}) };
    db.results["CampaignInvite.findOne"] = invite;
    db.results["Campaign.findById"] = { members: [], banned: [] };
    db.results["Campaign.findOneAndUpdate"] = null;
    expect(await answerInvite(ME, INVITE, "accept")).toEqual({
      ok: false, status: 409, error: "La campaña ha alcanzado el máximo de participantes.",
    });
    expect(invite.deleteOne).not.toHaveBeenCalled();
  });

  it("enlace de invitación: no válido, ya eres miembro o la campaña con su DM", async () => {
    expect(await loadInviteLanding("corto", ME)).toBeNull();
    const code = "A".repeat(22);
    db.results["Campaign.findOne"] = { _id: CAMPAIGN, owner: OTHER, members: [OTHER, ME] };
    expect(await loadInviteLanding(code, ME)).toEqual({ member: true, id: CAMPAIGN });
    db.results["Campaign.findOne"] = { _id: CAMPAIGN, owner: OTHER, members: [OTHER], name: "Saga", systemId: "dnd-2024" };
    db.results["User.findById"] = { username: "luis" };
    expect(await loadInviteLanding(code, ME)).toMatchObject({ member: false, name: "Saga", memberCount: 1, ownerName: "luis" });
  });
});
