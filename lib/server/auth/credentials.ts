import "server-only";
// Inicio de sesión y registro con usuario (o correo) y contraseña. Las rutas validan la entrada y ponen la cookie.
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/models/mongodb";
import { BannedEmail } from "@/lib/models/BannedEmail";
import { User } from "@/lib/models/User";
import { createVerificationToken } from "@/lib/server/auth/verification";
import { sendVerificationEmail } from "@/lib/server/notifications/mail";
import { fail, invalid, type Failure, type Result } from "@/lib/server/result";

// Hash falso: se compara igualmente cuando el usuario no existe, para que la
// respuesta tarde lo mismo y no se pueda averiguar qué cuentas existen.
// El coste (10) tiene que ser el mismo que el del registro.
const DUMMY_HASH = bcrypt.hashSync("no-existe", 10);

// Cuenta baneada o sin verificar: la respuesta lleva un código (y el correo, para pedir otro enlace)
export type SignInRefusal = {
  ok: false;
  status: 403;
  body: { error: string; code: "banned" } | { error: string; code: "unverified"; email: string };
};

export async function signIn(
  identifier: string,
  password: string,
): Promise<Result<{ id: string; username: string }> | SignInRefusal> {
  try {
    await connectDB();

    // Si lleva "@" es un correo; si no, un nombre de usuario. passwordHash no se devuelve por defecto, así que se pide.
    const isEmail = identifier.includes("@");
    const user = await User.findOne(
      isEmail ? { email: identifier.toLowerCase() } : { usernameLower: identifier.toLowerCase() },
    ).select("+passwordHash");

    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    // Mensaje genérico a propósito: no se dice si falló el usuario o la contraseña
    if (!user || !ok) return fail(401, "Credenciales incorrectas.");

    // Cuenta baneada: solo se avisa tras acertar la contraseña, para no revelar qué cuentas lo están
    if (user.bannedAt) {
      return {
        ok: false,
        status: 403,
        body: {
          error: user.banReason
            ? `Tu cuenta ha sido suspendida de forma permanente. Motivo: ${user.banReason}`
            : "Tu cuenta ha sido suspendida de forma permanente.",
          code: "banned",
        },
      };
    }
    // Si el usuario no está verificado, no se le permite iniciar sesión
    if (!user.verified) {
      return {
        ok: false,
        status: 403,
        body: { error: "Tu cuenta aún no está verificada. Revisa tu correo.", code: "unverified", email: user.email },
      };
    }

    return { ok: true, id: user._id.toString(), username: user.username };
  } catch (err) {
    console.error("Error al iniciar sesión:", err);
    return fail(500, "No se pudo iniciar sesión. Inténtalo de nuevo.");
  }
}

// Correo o usuario repetido (409)
const duplicated = (emailTaken: boolean): Failure =>
  invalid(
    emailTaken ? { email: "Ya existe una cuenta con ese correo." } : { username: "Ese nombre de usuario ya está en uso." },
    409,
  );

/* Crea la cuenta sin verificar y envía el correo de verificación. Si el correo no sale, se deshace el registro para
   que pueda volver a intentarlo con el mismo nombre y correo. La entrada ya viene validada. */
export async function registerUser(input: { username: string; email: string; password: string }): Promise<Result> {
  const { username, email, password } = input;
  try {
    await connectDB();
    const usernameLower = username.toLowerCase();

    // Un correo baneado no puede crear otra cuenta
    if (await BannedEmail.exists({ email })) {
      return invalid({ email: "Este correo no puede usarse para registrarse en Roll2Go." }, 403);
    }

    const existing = await User.findOne({ $or: [{ email }, { usernameLower }] });
    if (existing) return duplicated(existing.email === email);

    // Contraseña con coste 10. Verified es falso por defecto; el token de verificación se guarda en la cuenta.
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({ username, usernameLower, email, passwordHash });
    const { token, hash, expires } = createVerificationToken();
    newUser.verifyTokenHash = hash;
    newUser.verifyTokenExpires = expires;
    await newUser.save();

    try {
      await sendVerificationEmail(newUser.email, newUser.username, token);
    } catch (mailErr) {
      console.error("No se pudo enviar el correo de verificación:", mailErr);
      await User.deleteOne({ _id: newUser._id });
      return fail(502, "No se pudo enviar el correo de verificación. Inténtalo de nuevo en unos minutos.");
    }
    return { ok: true };
  } catch (err) {
    // 11000 significa clave duplicada en MongoDB
    if ((err as { code?: number }).code === 11000) {
      const key = (err as { keyPattern?: Record<string, unknown> }).keyPattern ?? {};
      return duplicated(!!key.email);
    }
    console.error("Error en el registro:", err);
    return fail(500, "No se pudo crear la cuenta. Inténtalo de nuevo.");
  }
}
