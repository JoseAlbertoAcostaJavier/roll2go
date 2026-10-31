import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const USER = "a00000000000000000000001";
const OLD_IMG = "d00000000000000000000001";
const NEW_IMG = "d00000000000000000000002";
const HASH = bcrypt.hashSync("secreto123", 4);

const db = await vi.hoisted(async () => (await import("./fakeDb")).createFakeDb());
const state = vi.hoisted(() => ({ mailFails: false, deleted: [] as string[] }));

vi.mock("@/lib/models/mongodb", () => ({ connectDB: async () => {} }));
for (const name of ["User", "CampaignImage"]) {
  vi.doMock(`@/lib/models/${name}`, () => ({ [name]: db.model(name) }));
}
vi.mock("@/lib/server/notifications/mail", () => ({
  sendVerificationEmail: async () => {
    if (state.mailFails) throw new Error("smtp");
  },
}));
vi.mock("@/lib/server/account/accountCleanup", () => ({ deleteUserData: async (id: string) => void state.deleted.push(id) }));
vi.mock("@/lib/server/campaigns/campaignInput", () => ({ storeImage: async () => NEW_IMG }));
vi.mock("@/lib/server/catalog/books", () => ({ officialBookIds: async (ids: string[]) => ids.filter((id) => id !== "ajeno") }));

const { updateAccount, deleteAccount, accountEmails } = await import("@/lib/server/account/settings");
const { updateProfile, setOwnedBooks } = await import("@/lib/server/account/profile");
const { loadImage } = await import("@/lib/server/account/images");

beforeEach(() => {
  db.reset();
  state.mailFails = false;
  state.deleted = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cuenta", () => {
  it("nombre de usuario no válido (400) o en uso (409)", async () => {
    expect(await updateAccount(USER, "username", { username: "a b" })).toMatchObject({ ok: false, status: 400 });
    db.results["User.exists"] = { _id: "otro" };
    expect(await updateAccount(USER, "username", { username: "Ana_2" })).toEqual({
      ok: false, status: 409, error: "Ese nombre de usuario ya está en uso.",
    });
    db.results["User.exists"] = null;
    expect(await updateAccount(USER, "username", { username: "Ana_2" })).toEqual({ ok: true, username: "Ana_2" });
  });

  it("las preferencias de correo se guardan solo con true", async () => {
    expect(await updateAccount(USER, "notifications", { messages: true, social: "sí" })).toEqual({ ok: true });
    const set = (db.callsOf("User", "updateOne")[0][1] as { $set: { emailPrefs: Record<string, unknown> } }).$set;
    expect(set.emailPrefs).toMatchObject({ campaigns: false, messages: true, social: false });
  });

  it("contraseña y correo exigen la contraseña actual", async () => {
    db.results["User.findById"] = { _id: USER, username: "Ana", email: "ana@x.es", passwordHash: HASH };
    expect(await updateAccount(USER, "password", { currentPassword: "mal", newPassword: "nueva1234" })).toEqual({
      ok: false, status: 403, error: "La contraseña actual no es correcta.",
    });
    expect(await updateAccount(USER, "password", { currentPassword: "secreto123", newPassword: "nueva1234" })).toEqual({ ok: true });
  });

  it("cambiar el correo lo deja pendiente; si el correo no sale, se deshace (502)", async () => {
    db.results["User.findById"] = { _id: USER, username: "Ana", email: "ana@x.es", passwordHash: HASH };
    db.results["User.exists"] = null;
    const body = { currentPassword: "secreto123", newEmail: "Nuevo@X.es" };
    expect(await updateAccount(USER, "email", body)).toEqual({ ok: true, pendingEmail: "nuevo@x.es" });
    state.mailFails = true;
    expect(await updateAccount(USER, "email", body)).toMatchObject({ ok: false, status: 502 });
    expect(db.callsOf("User", "updateOne").at(-1)?.[1]).toHaveProperty("$unset");
  });

  it("un dato repetido en la base de datos: 409", async () => {
    db.results["User.exists"] = null;
    db.results["User.updateOne"] = () => {
      throw Object.assign(new Error("dup"), { code: 11000 });
    };
    expect(await updateAccount(USER, "username", { username: "Ana_2" })).toEqual({ ok: false, status: 409, error: "Ese dato ya está en uso." });
  });

  it("borrar la cuenta exige la contraseña y el nombre exacto", async () => {
    db.results["User.findById"] = { _id: USER, username: "Ana", passwordHash: HASH };
    expect(await deleteAccount(USER, "mal", "Ana")).toMatchObject({ status: 403 });
    expect(await deleteAccount(USER, "secreto123", "ana")).toEqual({
      ok: false, status: 400, error: "El nombre de usuario escrito no coincide.",
    });
    expect(await deleteAccount(USER, "secreto123", " Ana ")).toEqual({ ok: true });
    expect(state.deleted).toEqual([USER]);
  });

  it("correo y correo pendiente para la página de la cuenta", async () => {
    db.results["User.findById"] = null;
    expect(await accountEmails(USER)).toEqual({ email: "", pendingEmail: null });
  });
});

describe("perfil", () => {
  const fields = { displayName: "Ana", pronouns: "", location: "", bio: "" };

  it("sin cuenta: 401", async () => {
    db.results["User.findById"] = null;
    expect(await updateProfile(USER, fields, undefined, false)).toEqual({ ok: false, status: 401, error: "Inicia sesión." });
  });

  it("una foto nueva sustituye a la antigua, que se borra después", async () => {
    db.results["User.findById"] = { _id: USER, avatarId: OLD_IMG };
    expect(await updateProfile(USER, fields, { data: Buffer.from("x"), contentType: "image/png" }, false)).toEqual({ ok: true });
    expect(db.callsOf("User", "updateOne")[0][1]).toEqual({
      $set: { displayName: "Ana", displayNameLower: "ana", pronouns: "", location: "", bio: "", avatarId: NEW_IMG },
    });
    expect(db.callsOf("CampaignImage", "deleteOne")).toEqual([[{ _id: OLD_IMG }]]);
  });

  it("si no se puede guardar, se borra la foto nueva", async () => {
    db.results["User.findById"] = { _id: USER };
    db.results["User.updateOne"] = () => {
      throw new Error("db");
    };
    expect(await updateProfile(USER, fields, { data: Buffer.from("x"), contentType: "image/png" }, false)).toMatchObject({
      status: 500,
    });
    expect(db.callsOf("CampaignImage", "deleteOne")).toEqual([[{ _id: NEW_IMG }]]);
  });

  it("solo se guardan libros oficiales", async () => {
    expect(await setOwnedBooks(USER, ["phb", "ajeno"])).toEqual(["phb"]);
    expect(db.callsOf("User", "updateOne")[0]).toEqual([{ _id: USER }, { $set: { ownedBooks: ["phb"] } }]);
  });

  it("una imagen con un id no válido o que no existe no se encuentra", async () => {
    expect(await loadImage("x")).toBeNull();
    db.results["CampaignImage.findById"] = null;
    expect(await loadImage(OLD_IMG)).toBeNull();
  });
});
