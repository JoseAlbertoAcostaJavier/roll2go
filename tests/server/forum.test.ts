import { beforeEach, describe, expect, it, vi } from "vitest";

const CAMPAIGN = "c00000000000000000000001";
const DM = "a00000000000000000000001";
const PLAYER = "a00000000000000000000002";
const OTHER = "a00000000000000000000003";
const ROOT = "f00000000000000000000001";
const REPLY = "f00000000000000000000002";

const db = await vi.hoisted(async () => (await import("./fakeDb")).createFakeDb());
const state = vi.hoisted(() => ({ notified: [] as Record<string, unknown>[] }));

for (const name of ["ForumPost", "ForumReaction", "Notification"]) {
  vi.doMock(`@/lib/models/${name}`, () => ({ [name]: db.model(name) }));
}
vi.mock("@/lib/server/account/userCards", () => ({
  loadUserCards: async (ids: unknown[]) =>
    new Map(ids.map((id) => [String(id), { id: String(id), username: `u${id}`, displayName: `Nombre ${id}`, avatarUrl: null }])),
}));
vi.mock("@/lib/server/forum/forumData", () => ({ loadReactions: async () => new Map() }));
vi.mock("@/lib/server/notifications/notify", () => ({ notify: async (n: Record<string, unknown>) => void state.notified.push(n) }));

const { createReply, createThread, deleteForumPost, editForumPost, toggleReaction } = await import("@/lib/server/forum/posts");
const { loadThread, listThreads } = await import("@/lib/server/forum/queries");

const campaign = { _id: CAMPAIGN, owner: DM, members: [DM, PLAYER] };
const ctx = (userId: string) => ({ session: { id: userId, username: "x" }, campaign: campaign as never, isDm: userId === DM });
type AccessCampaign = Parameters<typeof loadThread>[0];
const post = (author: string, parent: string | null = null) => ({
  _id: parent ? REPLY : ROOT, author, parent, pinned: false, save: vi.fn(async () => {}),
});

beforeEach(() => {
  db.reset();
  state.notified = [];
});

describe("publicar", () => {
  it("un hilo nuevo avisa a los demás participantes", async () => {
    db.results["ForumPost.create"] = { _id: ROOT };
    expect(await createThread(ctx(PLAYER), CAMPAIGN, { title: "Hola", content: "Texto" })).toEqual({
      ok: true, id: ROOT, rootId: ROOT, page: 1,
    });
    expect(state.notified).toEqual([{ user: DM, type: "campaign_post", actor: PLAYER, campaign: CAMPAIGN, post: ROOT }]);
  });

  it("responder a un hilo que no existe (o con un id no válido): 404", async () => {
    const gone = { ok: false, status: 404, error: "El mensaje ya no existe." };
    expect(await createReply(ctx(PLAYER), CAMPAIGN, { title: "", content: "x" }, "no-es-un-id", null)).toEqual(gone);
    db.results["ForumPost.findOne"] = null;
    expect(await createReply(ctx(PLAYER), CAMPAIGN, { title: "", content: "x" }, ROOT, null)).toEqual(gone);
  });

  it("la respuesta avisa al autor del hilo si sigue en la campaña", async () => {
    db.results["ForumPost.findOne"] = { _id: ROOT, author: DM };
    db.results["ForumPost.create"] = { _id: REPLY };
    db.results["ForumPost.countDocuments"] = 1;
    expect(await createReply(ctx(PLAYER), CAMPAIGN, { title: "", content: "x" }, ROOT, null)).toEqual({
      ok: true, id: REPLY, rootId: ROOT, page: 1,
    });
    expect(state.notified).toMatchObject([{ user: DM, type: "forum_reply" }]);
  });
});

describe("editar, fijar y borrar", () => {
  it("solo el DM fija, y solo mensajes principales", async () => {
    db.results["ForumPost.findOne"] = post(PLAYER);
    expect(await editForumPost(ctx(PLAYER), ROOT, { pinned: true })).toEqual({
      ok: false, status: 403, error: "Solo el DM puede fijar mensajes.",
    });
    expect(await editForumPost(ctx(DM), ROOT, { pinned: true })).toEqual({ ok: true, pinned: true });
    db.results["ForumPost.findOne"] = post(PLAYER, ROOT);
    expect(await editForumPost(ctx(DM), REPLY, { pinned: true })).toMatchObject({ status: 400 });
  });

  it("solo el autor edita su mensaje", async () => {
    db.results["ForumPost.findOne"] = post(PLAYER, ROOT);
    expect(await editForumPost(ctx(DM), REPLY, { content: "nuevo" })).toEqual({
      ok: false, status: 403, error: "Solo el autor puede editar el mensaje.",
    });
    expect(await editForumPost(ctx(PLAYER), REPLY, { content: "nuevo" })).toEqual({ ok: true });
  });

  it("borra el autor o el DM; nadie más", async () => {
    db.results["ForumPost.findOne"] = post(PLAYER, ROOT);
    expect(await deleteForumPost(ctx(OTHER), REPLY)).toEqual({ ok: false, status: 403, error: "No puedes borrar este mensaje." });
    expect(await deleteForumPost(ctx(DM), REPLY)).toEqual({ ok: true });
    expect(db.callsOf("ForumPost", "deleteMany")[0][0]).toEqual({ _id: { $in: [REPLY] } });
  });

  it("reaccionar a un mensaje de otra campaña: 404", async () => {
    db.results["ForumPost.exists"] = null;
    expect(await toggleReaction(ctx(PLAYER), ROOT, "👍")).toMatchObject({ status: 404 });
  });
});

describe("páginas del foro", () => {
  it("un hilo con un id no válido o de otra campaña no se encuentra", async () => {
    expect(await loadThread(campaign as unknown as AccessCampaign, "x", undefined, PLAYER, false)).toBeNull();
    db.results["ForumPost.findOne"] = null;
    db.results["ForumPost.countDocuments"] = 0;
    expect(await loadThread(campaign as unknown as AccessCampaign, ROOT, undefined, PLAYER, false)).toBeNull();
    expect(db.callsOf("ForumPost", "findOne")[0][0]).toEqual({ _id: ROOT, campaign: CAMPAIGN, parent: null });
  });

  it("permisos de cada mensaje: el DM borra y fija; el autor edita", async () => {
    const root = { _id: ROOT, author: PLAYER, title: "Hilo", content: "x", createdAt: new Date(), parent: null };
    db.results["ForumPost.findOne"] = root;
    db.results["ForumPost.countDocuments"] = 0;
    db.results["ForumPost.find"] = [];
    const asDm = await loadThread(campaign as unknown as AccessCampaign, ROOT, undefined, DM, true);
    expect(asDm?.root).toMatchObject({ canEdit: false, canDelete: true, canPin: true, authorIsDm: false });
    const asAuthor = await loadThread(campaign as unknown as AccessCampaign, ROOT, undefined, PLAYER, false);
    expect(asAuthor?.root).toMatchObject({ canEdit: true, canDelete: true, canPin: false });
  });

  it("la página pedida se ajusta al número de páginas", async () => {
    db.results["ForumPost.countDocuments"] = 3;
    db.results["ForumPost.find"] = [];
    db.results["ForumPost.aggregate"] = [];
    const r = await listThreads(campaign as unknown as AccessCampaign, "9");
    expect([r.total, r.pages, r.page]).toEqual([3, 1, 1]);
  });
});
