import { beforeEach, describe, expect, it, vi } from "vitest";

const CAMPAIGN = "c00000000000000000000001";
const DM = "a00000000000000000000001";
const PLAYER = "a00000000000000000000002";
const FRIEND = "a00000000000000000000003";
const ENTRY = "e00000000000000000000001";

const db = await vi.hoisted(async () => (await import("./fakeDb")).createFakeDb());
const state = vi.hoisted(() => ({
  notified: [] as Record<string, unknown>[],
  relation: "friend",
  blocked: false,
  target: null as null | { _id: string },
  deleted: [] as unknown[],
}));

vi.mock("@/lib/models/mongodb", () => ({ connectDB: async () => {} }));
for (const name of ["Campaign", "CampaignInvite", "CampaignLogEntry", "Character", "CampaignImage", "User", "Block"]) {
  vi.doMock(`@/lib/models/${name}`, () => ({ [name]: db.model(name) }));
}
vi.mock("@/lib/server/account/userCards", () => ({
  loadUserCards: async (ids: unknown[]) =>
    new Map(ids.map((id) => [String(id), { id: String(id), username: `u${id}`, displayName: `Nombre ${id}`, avatarUrl: null }])),
}));
vi.mock("@/lib/server/campaigns/campaignEligibility", () => ({
  joinReasons: async (_user: string, checks: unknown[]) => checks.map(() => null),
}));
vi.mock("@/lib/server/catalog/books", () => ({
  booksByIds: async (ids: string[]) => ids.map((id) => ({ id, name: `Libro ${id}` })),
  visibleBooksOf: async () => [],
}));
vi.mock("@/lib/server/social/blocks", () => ({
  blockedIdsOf: async () => [],
  blockStatus: async () => ({ any: state.blocked }),
}));
vi.mock("@/lib/server/social/friends", () => ({
  friendIdsOf: async () => [FRIEND, PLAYER],
  findUserByUsername: async () => state.target,
  relationBetween: async () => state.relation,
}));
vi.mock("@/lib/server/notifications/notify", () => ({ notify: async (n: Record<string, unknown>) => void state.notified.push(n) }));
vi.mock("@/lib/server/account/accountCleanup", () => ({ deleteCampaignData: async (c: unknown) => void state.deleted.push(c) }));

const queries = await import("@/lib/server/campaigns/queries");
const { createCampaign, updateCampaign, deleteCampaign } = await import("@/lib/server/campaigns/manageCampaign");
const { setInviteLink, inviteFriend } = await import("@/lib/server/campaigns/invites");
const { removeMember, deleteMemberNotes, unbanMember } = await import("@/lib/server/campaigns/memberActions");
const { updateLogEntry, deleteLogEntry, createLogEntry } = await import("@/lib/server/campaigns/logEntries");
const { joinByInviteCode } = await import("@/lib/server/campaigns/joinCampaign");

type AccessCampaign = Parameters<typeof queries.listCampaignCharacters>[0];
const campaign = (extra: Record<string, unknown> = {}) =>
  ({
    _id: CAMPAIGN,
    owner: DM,
    members: [DM, PLAYER],
    systemId: "dnd-2024",
    characters: { allowed: true, internal: true, external: true },
    ...extra,
  }) as unknown as AccessCampaign;
// Contexto de requireMember / requireDm
const ctx = (userId: string) => ({ session: { id: userId, username: "x" }, campaign: campaign() as never, isDm: userId === DM });

beforeEach(() => {
  db.reset();
  state.notified = [];
  state.relation = "friend";
  state.blocked = false;
  state.target = null;
  state.deleted = [];
});

describe("listMyCampaigns", () => {
  it("solo las campañas de las que es miembro, con los filtros y la búsqueda escapada", async () => {
    db.results["Campaign.find"] = [];
    db.results["CampaignInvite.find"] = [];
    await queries.listMyCampaigns(PLAYER, { q: "a.b", owner: "others", status: "inactive", sort: "name" });
    expect(db.callsOf("Campaign", "find")[0][0]).toEqual({
      members: PLAYER,
      owner: { $ne: PLAYER },
      status: "inactive",
      name: { $regex: "a\\.b", $options: "i" },
    });
  });

  it("«Todas» las campañas no filtra por estado; las invitaciones de campañas borradas no salen", async () => {
    db.results["Campaign.find"] = (filter: { _id?: unknown }) =>
      filter._id ? [] : [{ _id: CAMPAIGN, owner: DM, members: [DM, PLAYER] }];
    db.results["CampaignInvite.find"] = [{ _id: "i1", campaign: "c-borrada", invitedBy: DM }];
    const r = await queries.listMyCampaigns(PLAYER, { q: "", owner: "mine", status: "all", sort: "recent" });
    expect(db.callsOf("Campaign", "find")[0][0]).toEqual({ members: PLAYER, owner: PLAYER });
    expect(r.campaigns).toHaveLength(1);
    expect(r.invites).toEqual([]);
  });
});

describe("campaignOverview", () => {
  it("solo el DM carga las notas privadas", async () => {
    db.results["Campaign.findById"] = { privateNotes: "secreto" };
    expect((await queries.campaignOverview(campaign(), false)).notes).toBeUndefined();
    expect(db.callsOf("Campaign", "findById")).toEqual([]);
    expect((await queries.campaignOverview(campaign(), true)).notes).toBe("secreto");
  });

  it("el DM va primero y los libros solo se listan si la campaña los restringe", async () => {
    const r = await queries.campaignOverview(campaign({ restrictBooks: true, allowedBooks: ["b1"] }), false);
    expect(r.people.map((p) => p.id)).toEqual([DM, PLAYER]);
    expect(r.bookNames).toEqual(["Libro b1"]);
    expect((await queries.campaignOverview(campaign(), false)).bookNames).toBeNull();
  });
});

describe("listCampaignCharacters", () => {
  const found = [
    { _id: "p1", name: "Aprobado", owner: PLAYER, campaignStatus: "approved" },
    { _id: "p2", name: "Pendiente", owner: FRIEND, campaignStatus: "pending" },
  ];

  it("el DM ve también las solicitudes pendientes, que salen primero", async () => {
    db.results["Character.find"] = (f: { campaign?: unknown }) => (f.campaign ? found.map((c) => ({ ...c })) : []);
    const r = await queries.listCampaignCharacters(campaign(), DM, true);
    expect(db.callsOf("Character", "find")[0][0]).toEqual({ campaign: CAMPAIGN });
    expect(r.characters.map((c) => [c.name, c.pending])).toEqual([["Pendiente", true], ["Aprobado", false]]);
  });

  it("un jugador ve los aprobados y sus propias solicitudes", async () => {
    db.results["Character.find"] = [];
    await queries.listCampaignCharacters(campaign(), PLAYER, false);
    expect(db.callsOf("Character", "find")[0][0]).toEqual({
      campaign: CAMPAIGN,
      $or: [{ campaignStatus: { $ne: "pending" } }, { owner: PLAYER }],
    });
  });

  it("solo busca personajes que añadir si la campaña admite externos", async () => {
    db.results["Character.find"] = (f: { owner?: unknown }) => (f.owner === PLAYER ? [{ _id: "m1", name: "Mío", systemId: "dnd-2024" }] : []);
    const open = await queries.listCampaignCharacters(campaign(), PLAYER, false);
    expect(open.canAdd).toBe(true);
    expect(open.addable).toEqual([{ id: "m1", name: "Mío", summary: "", reason: null }]);

    db.reset();
    db.results["Character.find"] = [];
    const closed = await queries.listCampaignCharacters(
      campaign({ characters: { allowed: true, internal: true, external: false } }), PLAYER, false,
    );
    expect(closed.canAdd).toBe(false);
    expect(db.callsOf("Character", "find")).toHaveLength(1);
  });
});

describe("listMembers", () => {
  it("un jugador no recibe el enlace, los bloqueados ni las invitaciones", async () => {
    const r = await queries.listMembers(campaign(), PLAYER, false);
    expect(r.invite).toEqual({ code: null, expiresAt: null });
    expect([r.bannedIds, r.pendingIds, r.friends]).toEqual([[], [], []]);
    expect(db.callsOf("Campaign", "findById")).toEqual([]);
  });

  it("el DM recibe el enlace vigente y los amigos invitables (sin los que ya participan)", async () => {
    db.results["Campaign.findById"] = { inviteCode: "codigo", banned: [] };
    db.results["CampaignInvite.find"] = [];
    const r = await queries.listMembers(campaign(), DM, true);
    expect(r.invite).toEqual({ code: "codigo", expiresAt: null });
    expect(r.friends.map((f) => f.username)).toEqual([`u${FRIEND}`]);
  });

  it("un enlace caducado no se muestra", async () => {
    db.results["Campaign.findById"] = { inviteCode: "codigo", inviteExpires: new Date(Date.now() - 1000) };
    db.results["CampaignInvite.find"] = [];
    expect((await queries.listMembers(campaign(), DM, true)).invite).toEqual({ code: null, expiresAt: null });
  });
});

describe("listLogEntries", () => {
  beforeEach(() => {
    db.results["CampaignLogEntry.countDocuments"] = 0;
    db.results["CampaignLogEntry.find"] = [];
  });

  it("un jugador ve las públicas y las suyas; el DM, todas", async () => {
    await queries.listLogEntries(campaign(), PLAYER, false, "all", 1);
    await queries.listLogEntries(campaign(), DM, true, "private", 1);
    expect(db.callsOf("CampaignLogEntry", "find").map((a) => a[0])).toEqual([
      { campaign: CAMPAIGN, $or: [{ visibility: "public" }, { author: PLAYER }] },
      { campaign: CAMPAIGN, visibility: "private" },
    ]);
  });
});

describe("logEntryForEdit y campaignForEdit", () => {
  it("una nota solo se edita si es tuya; un id no válido ni se busca", async () => {
    expect(await queries.logEntryForEdit(CAMPAIGN, "no-es-un-id", PLAYER)).toBeNull();
    expect(db.callsOf("CampaignLogEntry", "findOne")).toEqual([]);
    db.results["CampaignLogEntry.findOne"] = null;
    expect(await queries.logEntryForEdit(CAMPAIGN, ENTRY, PLAYER)).toBeNull();
    expect(db.callsOf("CampaignLogEntry", "findOne")[0][0]).toEqual({ _id: ENTRY, campaign: CAMPAIGN, author: PLAYER });
  });

  it("solo el DM carga la campaña para editarla", async () => {
    db.results["Campaign.findOne"] = null;
    expect(await queries.campaignForEdit(CAMPAIGN, PLAYER)).toBeNull();
    expect(db.callsOf("Campaign", "findOne")[0][0]).toEqual({ _id: CAMPAIGN, owner: PLAYER });
  });
});

describe("crear, editar y borrar la campaña", () => {
  it("sin cuenta no se crea (401)", async () => {
    db.results["User.findById"] = null;
    expect(await createCampaign(PLAYER, new FormData())).toEqual({
      ok: false, status: 401, error: "Inicia sesión para crear una campaña.",
    });
  });

  it("errores del formulario: 400 con los errores por campo", async () => {
    db.results["User.findById"] = { _id: DM };
    const r = await createCampaign(DM, new FormData());
    expect(r.ok).toBe(false);
    expect(!r.ok && r.status).toBe(400);
    expect(!r.ok && r.errors?.name).toBeDefined();
  });

  it("quien no es el DM no la edita ni la borra (404)", async () => {
    db.results["Campaign.findOne"] = null;
    const notFound = { ok: false, status: 404, error: "Campaña no encontrada." };
    expect(await updateCampaign(PLAYER, CAMPAIGN, new FormData())).toEqual(notFound);
    expect(await deleteCampaign(PLAYER, CAMPAIGN, "Mi campaña")).toEqual(notFound);
  });

  it("para borrar hay que escribir el nombre exacto", async () => {
    db.results["Campaign.findOne"] = { _id: CAMPAIGN, name: "Mi campaña" };
    expect(await deleteCampaign(DM, CAMPAIGN, "Otra")).toEqual({
      ok: false, status: 400, error: "El nombre escrito no coincide con el de la campaña.",
    });
    expect(state.deleted).toEqual([]);
    expect(await deleteCampaign(DM, CAMPAIGN, "Mi campaña")).toEqual({ ok: true });
    expect(state.deleted).toHaveLength(1);
  });
});

describe("invitaciones", () => {
  it("caducidad no válida: 400", async () => {
    expect(await setInviteLink(ctx(DM), "3d")).toEqual({ ok: false, status: 400, error: "Caducidad no válida." });
  });

  it("un enlace sin caducidad borra la fecha", async () => {
    const r = await setInviteLink(ctx(DM), "never");
    expect(r.ok && r.expiresAt).toBeNull();
    expect(db.callsOf("Campaign", "updateOne")[0][1]).toMatchObject({ $unset: { inviteExpires: "" } });
  });

  it("solo se invita a amigos que existen, no a uno mismo, y sin bloqueos", async () => {
    expect(await inviteFriend(ctx(DM), CAMPAIGN, "nadie")).toMatchObject({ status: 404 });
    state.target = { _id: DM };
    expect(await inviteFriend(ctx(DM), CAMPAIGN, "yo")).toMatchObject({ status: 400 });
    state.target = { _id: FRIEND };
    state.relation = "none";
    expect(await inviteFriend(ctx(DM), CAMPAIGN, "otro")).toMatchObject({ status: 403 });
    state.relation = "friend";
    state.blocked = true;
    expect(await inviteFriend(ctx(DM), CAMPAIGN, "otro")).toEqual({
      ok: false, status: 403, error: "No puedes invitar a este usuario.",
    });
  });

  it("quien ya participa no se invita (409); un amigo nuevo, sí, con aviso", async () => {
    state.target = { _id: PLAYER };
    db.results["Campaign.findById"] = { _id: CAMPAIGN, members: [DM, PLAYER] };
    expect(await inviteFriend(ctx(DM), CAMPAIGN, "jugador")).toEqual({
      ok: false, status: 409, error: "Ya participa en la campaña.",
    });
    state.target = { _id: FRIEND };
    db.results["CampaignInvite.countDocuments"] = 0;
    expect(await inviteFriend(ctx(DM), CAMPAIGN, "amigo")).toEqual({ ok: true });
    expect(state.notified).toEqual([{ user: FRIEND, type: "campaign_invite", actor: DM, campaign: CAMPAIGN }]);
  });
});

describe("participantes", () => {
  it("el DM no puede irse ni ser expulsado; un jugador no expulsa a otro", async () => {
    expect(await removeMember(ctx(PLAYER), CAMPAIGN, DM, false)).toMatchObject({ status: 400 });
    expect(await removeMember(ctx(PLAYER), CAMPAIGN, FRIEND, false)).toEqual({
      ok: false, status: 403, error: "Solo el DM puede expulsar a un participante.",
    });
    expect(await removeMember(ctx(DM), CAMPAIGN, "no-es-un-id", false)).toMatchObject({ status: 404 });
  });

  it("solo el DM bloquea al expulsar, y se avisa al expulsado", async () => {
    db.results["Campaign.updateOne"] = { modifiedCount: 1 };
    db.results["CampaignLogEntry.countDocuments"] = 2;
    expect(await removeMember(ctx(DM), CAMPAIGN, PLAYER, true)).toEqual({ ok: true, notes: 2 });
    expect(db.callsOf("Campaign", "updateOne")[0][1]).toEqual({ $pull: { members: PLAYER }, $addToSet: { banned: PLAYER } });
    expect(state.notified).toMatchObject([{ user: PLAYER, type: "campaign_removed" }]);

    // Quien se va él mismo no se bloquea ni recibe aviso
    db.reset();
    db.results["Campaign.updateOne"] = { modifiedCount: 1 };
    state.notified = [];
    await removeMember(ctx(PLAYER), CAMPAIGN, PLAYER, true);
    expect(db.callsOf("Campaign", "updateOne")[0][1]).toEqual({ $pull: { members: PLAYER } });
    expect(state.notified).toEqual([]);
  });

  it("las notas de quien sigue en la campaña no se borran en bloque", async () => {
    expect(await deleteMemberNotes(ctx(DM), PLAYER)).toEqual({
      ok: false, status: 409, error: "Esta persona sigue en la campaña.",
    });
    db.results["CampaignLogEntry.deleteMany"] = { deletedCount: 3 };
    expect(await deleteMemberNotes(ctx(DM), FRIEND)).toEqual({ ok: true, deleted: 3 });
  });

  it("desbloquear un id no válido: 404", async () => {
    expect(await unbanMember(ctx(DM), "x")).toEqual({ ok: false, status: 404, error: "Usuario no encontrado." });
  });
});

describe("diario", () => {
  const entry = (author: string, visibility: string) => ({
    author, visibility, set: vi.fn(), save: vi.fn(async () => {}), deleteOne: vi.fn(async () => {}),
  });

  it("una nota privada ajena no existe para un jugador; el DM la puede borrar", async () => {
    db.results["CampaignLogEntry.findOne"] = entry(FRIEND, "private");
    expect(await deleteLogEntry(ctx(PLAYER), ENTRY)).toEqual({ ok: false, status: 404, error: "Nota no encontrada." });
    expect(await deleteLogEntry(ctx(DM), ENTRY)).toEqual({ ok: true });
  });

  it("solo el autor edita su nota", async () => {
    db.results["CampaignLogEntry.findOne"] = entry(PLAYER, "public");
    const value = { title: "T", content: "C", visibility: "public" as const };
    expect(await updateLogEntry(ctx(DM), ENTRY, value)).toEqual({
      ok: false, status: 403, error: "Solo el autor puede editar la nota.",
    });
    expect(await updateLogEntry(ctx(PLAYER), ENTRY, value)).toEqual({ ok: true });
  });

  it("una nota pública avisa al resto; una privada, a nadie", async () => {
    db.results["CampaignLogEntry.create"] = { _id: ENTRY };
    await createLogEntry(ctx(PLAYER), CAMPAIGN, { title: "T", content: "C", visibility: "private" });
    expect(state.notified).toEqual([]);
    expect(await createLogEntry(ctx(PLAYER), CAMPAIGN, { title: "T", content: "C", visibility: "public" })).toEqual({
      ok: true, id: ENTRY,
    });
    expect(state.notified).toEqual([{ user: DM, type: "campaign_note", actor: PLAYER, campaign: CAMPAIGN }]);
  });
});

describe("joinByInviteCode", () => {
  const CODE = "abcdefghijklmnopqrstuv";
  const invalid = { ok: false, status: 404, error: "El enlace no es válido o ha caducado." };

  it("un código mal formado o que no existe no vale", async () => {
    expect(await joinByInviteCode(PLAYER, "corto")).toEqual(invalid);
    expect(db.callsOf("Campaign", "findOne")).toEqual([]);
    db.results["Campaign.findOne"] = null;
    expect(await joinByInviteCode(PLAYER, CODE)).toEqual(invalid);
  });

  it("quien está bloqueado por el DM recibe el mismo mensaje", async () => {
    db.results["Campaign.findOne"] = { _id: CAMPAIGN, owner: DM };
    db.results["Block.exists"] = { _id: "b" };
    expect(await joinByInviteCode(PLAYER, CODE)).toEqual(invalid);
  });

  it("campaña llena: 409; si ya era miembro, already", async () => {
    db.results["Campaign.findOne"] = { _id: CAMPAIGN, owner: DM };
    db.results["Block.exists"] = null;
    db.results["Campaign.findById"] = { members: [DM], banned: [] };
    db.results["Campaign.findOneAndUpdate"] = null;
    expect(await joinByInviteCode(PLAYER, CODE)).toEqual({
      ok: false, status: 409, error: "La campaña ha alcanzado el máximo de participantes.",
    });
    db.results["Campaign.findById"] = { members: [DM, PLAYER], banned: [] };
    expect(await joinByInviteCode(PLAYER, CODE)).toEqual({ ok: true, id: CAMPAIGN, already: true });
  });
});
