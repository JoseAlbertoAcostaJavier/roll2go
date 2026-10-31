import { beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN = "a00000000000000000000001";
const TARGET = "a00000000000000000000002";

const db = await vi.hoisted(async () => (await import("./fakeDb")).createFakeDb());
const state = vi.hoisted(() => ({ notified: [] as Record<string, unknown>[], forgotten: [] as string[] }));

vi.mock("@/lib/models/mongodb", () => ({ connectDB: async () => {} }));
for (const name of ["User", "BannedEmail", "Notification"]) {
  vi.doMock(`@/lib/models/${name}`, () => ({ [name]: db.model(name) }));
}
vi.mock("@/lib/server/notifications/notify", () => ({ notify: async (n: Record<string, unknown>) => void state.notified.push(n) }));
vi.mock("@/lib/server/auth/ban", () => ({ forgetBan: (id: string) => void state.forgotten.push(id) }));

const { warnUser, banUser, unbanUser } = await import("@/lib/server/admin/moderation");
const { listUsers } = await import("@/lib/server/admin/users");

beforeEach(() => {
  db.reset();
  state.notified = [];
  state.forgotten = [];
});

describe("moderación", () => {
  it("advertir: id no válido o inexistente (404), a uno mismo (400)", async () => {
    expect(await warnUser(ADMIN, "x", "motivo")).toEqual({ ok: false, status: 404, error: "Usuario no encontrado." });
    expect(await warnUser(ADMIN, ADMIN, "motivo")).toEqual({ ok: false, status: 400, error: "No puedes advertirte a ti mismo." });
    db.results["User.updateOne"] = { matchedCount: 0 };
    expect(await warnUser(ADMIN, TARGET, "motivo")).toMatchObject({ status: 404 });
  });

  it("advertir guarda la advertencia y avisa al usuario", async () => {
    db.results["User.updateOne"] = { matchedCount: 1 };
    expect(await warnUser(ADMIN, TARGET, "spam")).toEqual({ ok: true });
    expect(state.notified).toEqual([
      { user: TARGET, type: "system", text: "Has recibido una advertencia de la moderación de Roll2Go. Motivo: spam" },
    ]);
  });

  it("no se banea a otro administrador ni dos veces", async () => {
    db.results["User.findById"] = { _id: TARGET, role: "admin" };
    expect(await banUser(ADMIN, TARGET, "spam")).toEqual({ ok: false, status: 403, error: "No puedes banear a otro administrador." });
    db.results["User.findById"] = { _id: TARGET, bannedAt: new Date() };
    expect(await banUser(ADMIN, TARGET, "spam")).toEqual({ ok: false, status: 409, error: "Este usuario ya está baneado." });
  });

  it("banear reserva el correo y olvida la caché del baneo", async () => {
    db.results["User.findById"] = { _id: TARGET, email: "t@x.es", bannedAt: null };
    db.results["User.updateOne"] = { modifiedCount: 1 };
    expect(await banUser(ADMIN, TARGET, "spam")).toEqual({ ok: true });
    expect(db.callsOf("BannedEmail", "updateOne")[0]).toEqual([{ email: "t@x.es" }, { $set: { user: TARGET } }, { upsert: true }]);
    expect(state.forgotten).toEqual([TARGET]);
  });

  it("quitar el baneo a quien no lo tiene: 409; si lo tiene, se le avisa", async () => {
    db.results["User.findById"] = { _id: TARGET, bannedAt: null };
    expect(await unbanUser(TARGET)).toEqual({ ok: false, status: 409, error: "Este usuario no está baneado." });
    db.results["User.findById"] = { _id: TARGET, email: "t@x.es", bannedAt: new Date() };
    expect(await unbanUser(TARGET)).toEqual({ ok: true });
    expect(state.notified).toMatchObject([{ user: TARGET, type: "system" }]);
  });
});

describe("listado de usuarios", () => {
  it("filtra por prefijo y estado, y da la vista de cada uno", async () => {
    db.results["User.countDocuments"] = 1;
    db.results["User.find"] = [
      {
        _id: TARGET, username: "ana", displayName: "", email: "a@x.es", verified: true, role: "user",
        createdAt: "2026-01-01T00:00:00.000Z", avatarId: "img", bannedAt: null,
        warnings: [{ reason: "uno", createdAt: new Date(1) }, { reason: "dos", createdAt: new Date(2) }],
      },
    ];
    const r = await listUsers("An", "warned", undefined);
    expect(db.callsOf("User", "countDocuments")[0][0]).toEqual({
      $or: [{ usernameLower: /^an/ }, { displayNameLower: /^an/ }],
      "warnings.0": { $exists: true },
    });
    expect(r.users[0]).toMatchObject({
      id: TARGET, displayName: "ana", avatarUrl: "/api/images/img", isAdmin: false, bannedAt: null, banReason: "",
    });
    expect(r.users[0].warnings.map((w) => w.reason)).toEqual(["dos", "uno"]);
  });
});
