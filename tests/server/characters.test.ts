import { beforeEach, describe, expect, it, vi } from "vitest";

const CAMPAIGN = "c00000000000000000000001";
const OTHER_CAMPAIGN = "c00000000000000000000002";
const OWNER = "a00000000000000000000001";
const DM = "a00000000000000000000002";
const CHAR = "b00000000000000000000001";

const db = await vi.hoisted(async () => (await import("./fakeDb")).createFakeDb());
const state = vi.hoisted(() => ({
  found: null as null | Record<string, unknown>,
  booksError: false,
  loads: 0,
}));

vi.mock("@/lib/models/mongodb", () => ({ connectDB: async () => {} }));
for (const name of ["Campaign", "Character", "CampaignImage", "Notification"]) {
  vi.doMock(`@/lib/models/${name}`, () => ({ [name]: db.model(name) }));
}
vi.mock("@/lib/server/characters/characterAccess", () => ({
  OUTDATED_SHEET_ERROR: "antigua",
  loadCharacterFor: async () => (state.loads++, state.found),
}));
vi.mock("@/lib/server/catalog/catalog", () => {
  class NotFoundError extends Error {}
  return {
    NotFoundError,
    usableBooks: async () => {
      if (state.booksError) throw new NotFoundError();
      return ["libro"];
    },
    listEntries: async () => [],
    listMasteryWeapons: async () => [],
    getEntries: async () => [],
    getEntry: async () => null,
    resolveRef: async () => null,
  };
});
vi.mock("@/lib/server/catalog/books", () => ({ visibleBooksOf: async () => [] }));
vi.mock("@/lib/server/campaigns/campaignEligibility", () => ({
  joinReasons: async (_user: string, checks: unknown[]) => checks.map(() => "no se puede"),
}));
vi.mock("@/lib/server/notifications/notify", () => ({ notify: async () => {} }));

const queries = await import("@/lib/server/characters/queries");
const { createCharacter } = await import("@/lib/server/characters/creation");
const { updateCharacter, deleteCharacter } = await import("@/lib/server/characters/editCharacter");
const { requestJoinCampaign, leaveCampaign } = await import("@/lib/server/characters/campaignMembership");
const { saveHp, saveMasteries, applySpellOperation } = await import("@/lib/server/characters/sheetEdits");
const { levelUp, deleteLastLevel } = await import("@/lib/server/characters/levels");

type Loaded = Parameters<typeof queries.loadSheetCampaign>[1];
const character = (extra: Record<string, unknown> = {}) =>
  ({ _id: CHAR, owner: OWNER, systemId: "dnd-2024", name: "Grog", ...extra }) as unknown as Loaded;
const notFound = { ok: false, status: 404, error: "Personaje no encontrado." };

beforeEach(() => {
  db.reset();
  state.found = null;
  state.booksError = false;
  state.loads = 0;
});

describe("listMyCharacters", () => {
  beforeEach(() => {
    db.results["Campaign.find"] = [];
    db.results["Character.find"] = [];
  });

  it("solo los personajes del usuario, con el estado elegido", async () => {
    await queries.listMyCharacters(OWNER, { q: "", status: "dead", sort: "recent" });
    expect(db.callsOf("Character", "find")[0][0]).toEqual({ owner: OWNER, status: "dead" });
    await queries.listMyCharacters(OWNER, { q: "", status: "all", sort: "name" });
    expect(db.callsOf("Character", "find")[1][0]).toEqual({ owner: OWNER });
  });

  it("la búsqueda mira nombre, especie, legado, clase y el nombre de sus campañas", async () => {
    db.results["Campaign.find"] = (f: { name?: unknown }) => (f.name ? [{ _id: CAMPAIGN }] : []);
    await queries.listMyCharacters(OWNER, { q: "elfo", status: "active", sort: "recent" });
    const filter = db.callsOf("Character", "find")[0][0] as { $or: Record<string, unknown>[] };
    expect(filter.$or.map((c) => Object.keys(c)[0])).toEqual([
      "name", "sheet.species.name", "sheet.lineage.name", "sheet.classesSummary.class.name", "sheet.classes.name", "campaign",
    ]);
    expect(filter.$or[5]).toEqual({ campaign: { $in: [CAMPAIGN] } });
    // Las campañas por nombre, solo de las que es miembro
    expect(db.callsOf("Campaign", "find")[1][0]).toMatchObject({ members: OWNER });
  });

  it("tarjetas con el nombre de su campaña y solo las campañas que admiten crear personajes en el diálogo", async () => {
    db.results["Campaign.find"] = [
      { _id: CAMPAIGN, name: "Abierta", systemId: "dnd-2024", characters: { allowed: true, internal: true } },
      { _id: OTHER_CAMPAIGN, name: "Cerrada", systemId: "dnd-2024", characters: { allowed: true, internal: false } },
    ];
    db.results["Character.find"] = [{ _id: CHAR, name: "Grog", systemId: "dnd-2024", status: "active", campaign: OTHER_CAMPAIGN }];
    const r = await queries.listMyCharacters(OWNER, { q: "", status: "active", sort: "recent" });
    expect(r.cards[0].campaign).toEqual({ id: OTHER_CAMPAIGN, name: "Cerrada" });
    expect(r.dialogCampaigns.map((c) => c.name)).toEqual(["Abierta"]);
  });
});

describe("loadCreatorPage", () => {
  const params = { systemId: "dnd-2024", campaignId: CAMPAIGN, chosenBooks: [] };

  it("sin campaña, solo las listas", async () => {
    expect(await queries.loadCreatorPage(OWNER, { ...params, campaignId: "" })).toMatchObject({ campaign: null });
  });

  it("no miembro, id no válido, otro sistema o sin personajes internos: 404", async () => {
    expect(await queries.loadCreatorPage(OWNER, { ...params, campaignId: "x" })).toBeNull();
    db.results["Campaign.findOne"] = null;
    expect(await queries.loadCreatorPage(OWNER, params)).toBeNull();
    expect(db.callsOf("Campaign", "findOne")[0][0]).toEqual({ _id: CAMPAIGN, members: OWNER });
    db.results["Campaign.findOne"] = { name: "C", systemId: "otro", characters: { allowed: true, internal: true } };
    expect(await queries.loadCreatorPage(OWNER, params)).toBeNull();
    db.results["Campaign.findOne"] = { name: "C", systemId: "dnd-2024", characters: { allowed: true, internal: false } };
    expect(await queries.loadCreatorPage(OWNER, params)).toBeNull();
  });

  it("con una campaña válida la devuelve; si los libros no se pueden usar, 404", async () => {
    db.results["Campaign.findOne"] = { name: "C", systemId: "dnd-2024", characters: { allowed: true, internal: true } };
    expect(await queries.loadCreatorPage(OWNER, params)).toMatchObject({ campaign: { id: CAMPAIGN, name: "C" } });
    state.booksError = true;
    expect(await queries.loadCreatorPage(OWNER, params)).toBeNull();
  });
});

describe("loadSheetCampaign y campaignRefOf", () => {
  it("con campaña: si está pendiente y si quien mira es el DM", async () => {
    db.results["Campaign.findById"] = { _id: CAMPAIGN, name: "C", owner: DM };
    const r = await queries.loadSheetCampaign(DM, character({ campaign: CAMPAIGN, campaignStatus: "pending" }), false);
    expect(r).toEqual({ campaign: { id: CAMPAIGN, name: "C", pending: true, isDm: true }, joinable: [] });
  });

  it("sin campaña, solo el dueño recibe las campañas a las que puede unirlo, con su motivo", async () => {
    db.results["Campaign.find"] = [{ _id: CAMPAIGN, name: "C", owner: DM }];
    expect((await queries.loadSheetCampaign(DM, character(), false)).joinable).toEqual([]);
    expect(db.callsOf("Campaign", "find")).toEqual([]);
    const r = await queries.loadSheetCampaign(OWNER, character(), true);
    expect(r.joinable).toEqual([{ id: CAMPAIGN, name: "C", isDm: false, reason: "no se puede" }]);
    expect(db.callsOf("Campaign", "find")[0][0]).toEqual({ members: OWNER, status: "active", systemId: "dnd-2024" });
  });

  it("campaignRefOf: null sin campaña o si ya no existe", async () => {
    expect(await queries.campaignRefOf(character())).toBeNull();
    db.results["Campaign.findById"] = null;
    expect(await queries.campaignRefOf(character({ campaign: CAMPAIGN }))).toBeNull();
    db.results["Campaign.findById"] = { name: "C" };
    expect(await queries.campaignRefOf(character({ campaign: CAMPAIGN }))).toEqual({ id: CAMPAIGN, name: "C" });
  });
});

describe("alta y edición", () => {
  it("un sistema sin creador: 400", async () => {
    const form = new FormData();
    form.set("system", "otro");
    expect(await createCharacter(OWNER, form)).toEqual({ ok: false, status: 400, error: "Sistema de juego no disponible." });
  });

  it("una campaña de la que no es miembro: 404", async () => {
    const form = new FormData();
    form.set("system", "dnd-2024");
    form.set("campaign", CAMPAIGN);
    db.results["Campaign.findOne"] = null;
    expect(await createCharacter(OWNER, form)).toEqual({ ok: false, status: 404, error: "Campaña no encontrada." });
  });

  it("editar o borrar un personaje ajeno: 404", async () => {
    expect(await updateCharacter(DM, CHAR, new FormData())).toEqual(notFound);
    expect(await deleteCharacter(DM, CHAR)).toEqual(notFound);
    expect(db.callsOf("Character", "deleteOne")).toEqual([]);
  });

  it("errores por campo en orden; y la hoja antigua no se escribe", async () => {
    state.found = { character: character(), outdated: true };
    const form = new FormData();
    form.set("name", "");
    form.set("status", "raro");
    expect(await updateCharacter(OWNER, CHAR, form)).toEqual({
      ok: false, status: 400, errors: { name: "Escribe un nombre.", status: "Estado no válido." },
    });
    const notes = new FormData();
    notes.set("notes", "hola");
    expect(await updateCharacter(OWNER, CHAR, notes)).toEqual({ ok: false, status: 409, error: "antigua" });
  });
});

describe("campaña del personaje", () => {
  it("unir a una campaña con un id no válido: 404 sin cargar el personaje", async () => {
    expect(await requestJoinCampaign(OWNER, CHAR, "x")).toEqual({ ok: false, status: 404, error: "Campaña no encontrada." });
    expect(state.loads).toBe(0);
  });

  it("si no puede unirse, 400 con el motivo", async () => {
    state.found = { character: character(), sheet: {}, outdated: false };
    db.results["Campaign.findById"] = { _id: CAMPAIGN, owner: DM };
    expect(await requestJoinCampaign(OWNER, CHAR, CAMPAIGN)).toEqual({ ok: false, status: 400, error: "no se puede" });
    expect(db.callsOf("Character", "updateOne")).toEqual([]);
  });

  it("sacar de la campaña un personaje que no está en ninguna: 409", async () => {
    db.results["Character.findOne"] = { _id: CHAR, name: "Grog" };
    expect(await leaveCampaign(OWNER, CHAR)).toEqual({
      ok: false, status: 409, error: "Este personaje no está en ninguna campaña.",
    });
    db.results["Character.findOne"] = null;
    expect(await leaveCampaign(DM, CHAR)).toEqual(notFound);
  });
});

describe("cambios en la hoja", () => {
  it("maestrías y operaciones de conjuros no válidas: 400 sin cargar el personaje", async () => {
    expect(await saveMasteries(OWNER, CHAR, { masteries: "x" })).toEqual({ ok: false, status: 400, error: "Maestrías no válidas." });
    expect(await applySpellOperation(OWNER, CHAR, { op: "volar" })).toEqual({ ok: false, status: 400, error: "Operación no válida." });
    expect(state.loads).toBe(0);
  });

  it("personaje ajeno: 404; hoja antigua: 409", async () => {
    expect(await saveHp(DM, CHAR, { current: 1 })).toEqual(notFound);
    expect(await levelUp(DM, CHAR, {})).toEqual(notFound);
    expect(await deleteLastLevel(DM, CHAR)).toEqual(notFound);
    state.found = { character: character(), outdated: true };
    expect(await saveHp(OWNER, CHAR, { current: 1 })).toEqual({ ok: false, status: 409, error: "antigua" });
    expect(await saveMasteries(OWNER, CHAR, { masteries: [] })).toEqual({ ok: false, status: 409, error: "antigua" });
    expect(db.callsOf("Character", "updateOne")).toEqual([]);
  });
});
