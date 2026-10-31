import "server-only";
// Enlaces que llegan por correo: verificar la cuenta (o el correo nuevo), pedir otro enlace y recuperar la contraseña.
// Las rutas ya han comprobado el formato del token y del correo.
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/models/mongodb";
import { User } from "@/lib/models/User";
import { createResetToken, createVerificationToken, hashToken, VERIFY_TTL_MS } from "@/lib/server/auth/verification";
import { sendVerificationEmail } from "@/lib/server/notifications/mail";
import { fail, type Result } from "@/lib/server/result";

const COOLDOWN_MS = 60 * 1000; // mínimo entre dos envíos al mismo correo

// Enlace caducado o que no vale: la respuesta lleva un código (y el correo, para pedir otro)
export type VerifyRefusal = {
  ok: false;
  status: 400 | 410;
  body: { error: string; code: "expired"; email: string } | { error: string; code: "invalid" };
};

/* Verifica la cuenta. Si hay un cambio de correo pendiente, se aplica ahora; el filtro por hash hace que solo un clic
   pueda gastar el token. */
export async function verifyAccount(token: string): Promise<Result | VerifyRefusal> {
  try {
    await connectDB();
    const hash = hashToken(token);

    const user = await User.findOne({ verifyTokenHash: hash, verifyTokenExpires: { $gt: new Date() } }).select(
      "+pendingEmail",
    );
    if (user) {
      const result = await User.updateOne(
        { _id: user._id, verifyTokenHash: hash },
        {
          $set: { verified: true, ...(user.pendingEmail ? { email: user.pendingEmail } : {}) },
          $unset: { verifyTokenHash: "", verifyTokenExpires: "", pendingEmail: "" },
        },
      );
      if (result.modifiedCount === 1) return { ok: true };
    }

    // No ha servido: ¿ha caducado, o no existe / ya se usó?
    const expired = await User.findOne({ verifyTokenHash: hash }).select("email");
    if (expired) {
      return {
        ok: false,
        status: 410,
        body: { error: "El enlace ha caducado. Pide uno nuevo.", code: "expired", email: expired.email },
      };
    }
    return {
      ok: false,
      status: 400,
      body: {
        error: "El enlace no es válido o ya se ha usado. Si ya verificaste tu cuenta, inicia sesión.",
        code: "invalid",
      },
    };
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return fail(409, "Ese correo ya está en uso por otra cuenta.");
    console.error("Error al verificar la cuenta:", err);
    return fail(500, "No se pudo verificar la cuenta. Inténtalo de nuevo.");
  }
}

/* Otro enlace de verificación para una cuenta sin verificar, como mucho uno por minuto. El token nuevo se guarda
   encima del anterior, que deja de valer. Siempre responde igual, exista la cuenta o no. */
export async function resendVerification(email: string): Promise<Result> {
  try {
    await connectDB();
    const user = await User.findOne({ email, verified: { $ne: true } }).select("+verifyTokenExpires");

    if (user) {
      // El momento del último envío se deduce de la caducidad del token anterior
      const lastSent = user.verifyTokenExpires ? user.verifyTokenExpires.getTime() - VERIFY_TTL_MS : 0;
      if (Date.now() - lastSent >= COOLDOWN_MS) {
        const { token, hash, expires } = createVerificationToken();
        await User.updateOne({ _id: user._id }, { $set: { verifyTokenHash: hash, verifyTokenExpires: expires } });
        await sendVerificationEmail(user.email, user.username, token);
      }
    }
    return { ok: true };
  } catch (err) {
    console.error("Error al reenviar la verificación:", err);
    return fail(500, "No se pudo enviar el correo. Inténtalo de nuevo en unos minutos.");
  }
}

/* Guarda en la cuenta del correo (si existe) el hash de un token de recuperación y devuelve lo necesario para el
   correo, que la ruta envía después de responder. Sin cuenta no hay correo, pero la respuesta es la misma. */
export async function requestPasswordReset(
  email: string,
): Promise<Result<{ mail: { email: string; username: string; token: string } | null }>> {
  try {
    await connectDB();
    const user = await User.findOne({ email });
    if (!user) return { ok: true, mail: null };

    const { token, hash, expires } = createResetToken();
    user.resetTokenHash = hash;
    user.resetTokenExpires = expires;
    await user.save();
    return { ok: true, mail: { email: user.email, username: user.username, token } };
  } catch (err) {
    console.error("Error en forgot_password:", err);
    return fail(500, "Error interno del servidor.");
  }
}

/* Cambia la contraseña con el token del correo. Operación atómica: solo una petición puede gastar el token, y solo si
   no ha caducado. verified: true, porque abrir el enlace del correo demuestra que el correo es suyo. */
export async function resetPassword(token: string, password: string): Promise<Result> {
  try {
    await connectDB();
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      { resetTokenHash: hashToken(token), resetTokenExpires: { $gt: new Date() } },
      {
        $set: { passwordHash, verified: true },
        $unset: { resetTokenHash: "", resetTokenExpires: "", verifyTokenHash: "", verifyTokenExpires: "" },
      },
    );
    if (!user) return fail(400, "El enlace es inválido o ha expirado. Pide uno nuevo.");
    return { ok: true };
  } catch (error) {
    console.error("Error en reset_password:", error);
    return fail(500, "Error interno del servidor.");
  }
}
