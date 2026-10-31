import { beforeEach, describe, expect, it, vi } from "vitest";

const USER = "a00000000000000000000001";
const BOOK = "b00000000000000000000001";
const ENTRY = "e00000000000000000000001";

const db = await vi.hoisted(async () => (await import("./fakeDb")).createFakeDb());

vi.mock("@/lib/models/mongodb", () => ({ connectDB: async () => {} }));
for (const name of ["Book", "BookEntry", "Notification", "Campaign", "User"]) {
  vi.doMock(`@/lib/models/${name}`, () => ({ [name]: db.model(name) }));
}

const books = await import("@/lib/server/books/books");
const notifications = await import("@/lib/server/notifications/notifications");

beforeEach(() => {
  db.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("libros propios", () => {
  it("no se pasa del máximo de libros por usuario", async () => {
    db.results["Book.countDocuments"] = 50;
    expect(await books.createBook(USER, { name: "Mío", systemId: "dnd-2024", description: "" })).toEqual({
      ok: false, status: 400, error: "Has alcanzado el máximo de 50 libros.",
    });
  });

  it("un libro nuevo es privado y con licencia propia", async () => {
    db.results["Book.countDocuments"] = 0;
    db.results["Book.create"] = { _id: BOOK };
    expect(await books.createBook(USER, { name: "Mío", systemId: "dnd-2024", description: "" })).toEqual({ ok: true, id: BOOK });
    expect(db.callsOf("Book", "create")[0][0]).toMatchObject({ owner: USER, visibility: "private", license: { type: "own" } });
  });

  it("la clave de una entrada nueva lleva el tipo y el nombre normalizado", async () => {
    db.results["BookEntry.countDocuments"] = 0;
    db.results["BookEntry.create"] = { _id: ENTRY };
    expect(await books.createBookEntry(BOOK, { kind: "spell", name: "Bola de Fuego", description: "" })).toEqual({
      ok: true, id: ENTRY,
    });
    const doc = db.callsOf("BookEntry", "create")[0][0] as { key: string; nameLower: string };
    expect(doc.key).toMatch(/^spell:bola-de-fuego\|[0-9a-f]{24}$/);
    expect(doc.nameLower).toBe("bola de fuego");
  });

  it("buscar entradas por tipo y prefijo; editar una de otro libro no hace nada", async () => {
    db.results["BookEntry.find"] = [];
    await books.listBookEntries(BOOK, "spell", "Bola");
    expect(db.callsOf("BookEntry", "find")[0][0]).toEqual({ book: BOOK, kind: "spell", nameLower: { $regex: "^bola" } });
    db.results["BookEntry.updateOne"] = { matchedCount: 0 };
    expect(await books.updateBookEntry(BOOK, ENTRY, { name: "Otro" })).toBe(false);
    expect(await books.getBookEntry(BOOK, "x")).toBeNull();
  });
});

describe("notificaciones", () => {
  it("con límite 0 solo da el contador", async () => {
    db.results["Notification.countDocuments"] = 3;
    expect(await notifications.listNotifications(USER, 0)).toEqual({ unread: 3 });
  });

  it("cada aviso lleva su texto, su enlace y quién lo provocó", async () => {
    db.results["Notification.countDocuments"] = 1;
    db.results["Notification.find"] = [
      { _id: "n1", type: "friend_request", actor: "a2", read: false, createdAt: new Date(0) },
    ];
    db.results["User.find"] = [{ _id: "a2", username: "luis", displayName: "", avatarId: null }];
    db.results["Campaign.find"] = [];
    const r = await notifications.listNotifications(USER, 10);
    expect(r.items?.[0]).toMatchObject({
      id: "n1", read: false, createdAt: new Date(0).toISOString(), actor: { username: "luis", displayName: "luis", avatarUrl: null },
    });
    expect(r.items?.[0].text).toBeTypeOf("string");
  });

  it("marcar o borrar solo con { all: true } o un id válido", async () => {
    const bad = { ok: false, status: 400, error: "Petición no válida." };
    expect(await notifications.markNotificationsRead(USER, { id: "x" })).toEqual(bad);
    expect(await notifications.deleteNotifications(USER, null)).toEqual(bad);
    expect(await notifications.deleteNotifications(USER, { all: true })).toEqual({ ok: true });
    expect(db.callsOf("Notification", "deleteMany")[0][0]).toEqual({ user: USER });
    expect(await notifications.markNotificationsRead(USER, { id: ENTRY })).toEqual({ ok: true });
    expect(db.callsOf("Notification", "updateOne")[0][0]).toEqual({ _id: ENTRY, user: USER });
  });
});
