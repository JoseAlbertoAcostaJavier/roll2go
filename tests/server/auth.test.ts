import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const USER = "a00000000000000000000001";
const TOKEN = "a".repeat(64);
const HASH = bcrypt.hashSync("secreto123", 4);

const db = await vi.hoisted(async () => (await import("./fakeDb")).createFakeDb());
const state = vi.hoisted(() => ({ mails: [] as unknown[][], mailFails: false, saved: [] as Record<string, unknown>[] }));

vi.mock("@/lib/models/mongodb", () => ({ connectDB: async () => {} }));
vi.mock("@/lib/models/BannedEmail", () => ({ BannedEmail: db.model("BannedEmail") }));
// User se puede construir (new User(...)) además de consultar
vi.mock("@/lib/models/User", () => {
  function User(this: Record<string, unknown>, doc: Record<string, unknown>) {
    Object.assign(this, { _id: USER, ...doc, save: async () => void state.saved.push({ ...this }) });
  }
  const statics = db.model("User") as Record<string, unknown>;
  return { User: new Proxy(User, { get: (t, op) => (op in t ? t[op as keyof typeof t] : statics[op as string]) }) };
});
vi.mock("@/lib/server/notifications/mail", () => ({
  sendVerificationEmail: async (...args: unknown[]) => {
    if (state.mailFails) throw new Error("smtp");
    state.mails.push(args);
  },
}));

const { signIn, registerUser } = await import("@/lib/server/auth/credentials");
const { verifyAccount, resendVerification, requestPasswordReset, resetPassword } = await import(
  "@/lib/server/auth/emailTokens"
);

const account = (extra: Record<string, unknown> = {}) => ({
  _id: USER, username: "Ana", email: "ana@x.es", passwordHash: HASH, verified: true, ...extra,
});

beforeEach(() => {
  db.reset();
  state.mails = [];
  state.mailFails = false;
  state.saved = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("iniciar sesión", () => {
  it("usuario inexistente o contraseña incorrecta: el mismo 401", async () => {
    const wrong = { ok: false, status: 401, error: "Credenciales incorrectas." };
    db.results["User.findOne"] = null;
    expect(await signIn("nadie", "secreto123")).toEqual(wrong);
    db.results["User.findOne"] = account();
    expect(await signIn("Ana", "otra-clave")).toEqual(wrong);
  });

  it("busca por correo si lleva @ y por usuario si no, en minúsculas", async () => {
    db.results["User.findOne"] = account();
    expect(await signIn("ANA@X.ES", "secreto123")).toEqual({ ok: true, id: USER, username: "Ana" });
    await signIn("ANA", "secreto123");
    expect(db.callsOf("User", "findOne").map((a) => a[0])).toEqual([{ email: "ana@x.es" }, { usernameLower: "ana" }]);
  });

  it("cuenta baneada o sin verificar: 403 con su código", async () => {
    db.results["User.findOne"] = account({ bannedAt: new Date(), banReason: "spam" });
    expect(await signIn("Ana", "secreto123")).toEqual({
      ok: false,
      status: 403,
      body: { error: "Tu cuenta ha sido suspendida de forma permanente. Motivo: spam", code: "banned" },
    });
    db.results["User.findOne"] = account({ verified: false });
    expect(await signIn("Ana", "secreto123")).toEqual({
      ok: false,
      status: 403,
      body: { error: "Tu cuenta aún no está verificada. Revisa tu correo.", code: "unverified", email: "ana@x.es" },
    });
  });
});

describe("registro", () => {
  const input = { username: "Ana", email: "ana@x.es", password: "secreto123" };

  it("crea la cuenta y envía el correo de verificación", async () => {
    db.results["BannedEmail.exists"] = null;
    db.results["User.findOne"] = null;
    expect(await registerUser(input)).toEqual({ ok: true });
    expect(state.saved[0]).toMatchObject({ username: "Ana", usernameLower: "ana", email: "ana@x.es" });
    expect(state.mails).toHaveLength(1);
  });

  it("correo baneado: 403; correo o usuario repetido: 409", async () => {
    db.results["BannedEmail.exists"] = { _id: "x" };
    expect(await registerUser(input)).toEqual({
      ok: false, status: 403, errors: { email: "Este correo no puede usarse para registrarse en Roll2Go." },
    });
    db.results["BannedEmail.exists"] = null;
    db.results["User.findOne"] = { email: "otro@x.es" };
    expect(await registerUser(input)).toEqual({
      ok: false, status: 409, errors: { username: "Ese nombre de usuario ya está en uso." },
    });
    db.results["User.findOne"] = () => {
      throw Object.assign(new Error("dup"), { code: 11000, keyPattern: { email: 1 } });
    };
    expect(await registerUser(input)).toEqual({
      ok: false, status: 409, errors: { email: "Ya existe una cuenta con ese correo." },
    });
  });

  it("si el correo no sale, se deshace el registro (502)", async () => {
    db.results["BannedEmail.exists"] = null;
    db.results["User.findOne"] = null;
    state.mailFails = true;
    expect(await registerUser(input)).toMatchObject({ ok: false, status: 502 });
    expect(db.callsOf("User", "deleteOne")).toEqual([[{ _id: USER }]]);
  });
});

describe("enlaces del correo", () => {
  it("verificar: aplica el correo pendiente y gasta el token", async () => {
    db.results["User.findOne"] = { _id: USER, pendingEmail: "nuevo@x.es" };
    db.results["User.updateOne"] = { modifiedCount: 1 };
    expect(await verifyAccount(TOKEN)).toEqual({ ok: true });
    expect(db.callsOf("User", "updateOne")[0][1]).toMatchObject({ $set: { verified: true, email: "nuevo@x.es" } });
  });

  it("verificar con un enlace caducado (410) o que no existe (400)", async () => {
    db.results["User.findOne"] = (filter: Record<string, unknown>) =>
      "verifyTokenExpires" in filter ? null : { email: "ana@x.es" };
    expect(await verifyAccount(TOKEN)).toEqual({
      ok: false, status: 410, body: { error: "El enlace ha caducado. Pide uno nuevo.", code: "expired", email: "ana@x.es" },
    });
    db.results["User.findOne"] = null;
    expect(await verifyAccount(TOKEN)).toMatchObject({ ok: false, status: 400, body: { code: "invalid" } });
  });

  it("reenviar: no manda otro correo antes de un minuto", async () => {
    // El token anterior se creó hace unos segundos: caduca dentro de casi 30 minutos
    db.results["User.findOne"] = { _id: USER, email: "ana@x.es", verifyTokenExpires: new Date(Date.now() + 29.9 * 60 * 1000) };
    expect(await resendVerification("ana@x.es")).toEqual({ ok: true });
    expect(state.mails).toEqual([]);
    db.results["User.findOne"] = { _id: USER, email: "ana@x.es", username: "Ana" };
    await resendVerification("ana@x.es");
    expect(state.mails).toHaveLength(1);
  });

  it("recuperar la contraseña: sin cuenta no hay correo; con cuenta, se guarda el hash", async () => {
    db.results["User.findOne"] = null;
    expect(await requestPasswordReset("nadie@x.es")).toEqual({ ok: true, mail: null });
    const user = { email: "ana@x.es", username: "Ana", save: vi.fn(async () => {}) } as Record<string, unknown>;
    db.results["User.findOne"] = user;
    const r = await requestPasswordReset("ana@x.es");
    expect(r).toMatchObject({ ok: true, mail: { email: "ana@x.es", username: "Ana" } });
    expect(user.resetTokenHash).toBeTypeOf("string");
    expect(user.save).toHaveBeenCalled();
  });

  it("cambiar la contraseña con un enlace no válido: 400", async () => {
    db.results["User.findOneAndUpdate"] = null;
    expect(await resetPassword(TOKEN, "secreto123")).toEqual({
      ok: false, status: 400, error: "El enlace es inválido o ha expirado. Pide uno nuevo.",
    });
  });
});
