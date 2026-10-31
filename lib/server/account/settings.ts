import "server-only";
// Ajustes de la cuenta: lo que muestran las páginas de ajustes y los cambios de PATCH/DELETE /api/account. Quien pide
// el cambio es el propio usuario (sesión) y el límite de peticiones ya se ha comprobado.
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/models/mongodb";
import { User } from "@/lib/models/User";
import { deleteUserData } from "@/lib/server/account/accountCleanup";
import { createVerificationToken } from "@/lib/server/auth/verification";
import { sendVerificationEmail } from "@/lib/server/notifications/mail";
import { fail, type Result } from "@/lib/server/result";
import { CAMPAIGN_EMAIL_PREFS, type EmailPrefs } from "@/lib/shared/notificationText";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v: unknown) => (typeof v === "string" ? v : "");

// Correo actual y, si lo hay, el nuevo pendiente de confirmar (página de la cuenta)
export async function accountEmails(userId: string) {
  await connectDB();
  const u = await User.findById(userId).select("email +pendingEmail").lean();
  return { email: (u?.email ?? "") as string, pendingEmail: (u?.pendingEmail ?? null) as string | null };
}

// Preferencias de correo guardadas (página de notificaciones)
export async function emailPrefsOf(userId: string) {
  await connectDB();
  const u = await User.findById(userId).select("emailPrefs").lean();
  return u?.emailPrefs as EmailPrefs | undefined;
}

// Datos del perfil que se editan en la página del perfil
export async function profileFields(userId: string) {
  await connectDB();
  const u = await User.findById(userId).select("displayName pronouns location bio").lean();
  return {
    displayName: (u?.displayName ?? "") as string,
    pronouns: (u?.pronouns ?? "") as string,
    location: (u?.location ?? "") as string,
    bio: (u?.bio ?? "") as string,
  };
}

/* Un cambio de PATCH /api/account según `kind` (notifications, username, password o email). Devuelve lo que se
   responde: { username } al cambiar el nombre, { pendingEmail } al pedir el cambio de correo; si no, nada. */
export async function updateAccount(
  userId: string,
  kind: string,
  body: Record<string, unknown>,
): Promise<Result<{ username?: string; pendingEmail?: string }>> {
  await connectDB();
  try {
    if (kind === "notifications") {
      const flag = (v: unknown) => v === true;
      const types = (body.campaignTypes ?? {}) as Record<string, unknown>;
      const campaignTypes = Object.fromEntries(CAMPAIGN_EMAIL_PREFS.map(({ key }) => [key, flag(types[key])]));
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            emailPrefs: {
              campaigns: Object.values(campaignTypes).some(Boolean),
              messages: flag(body.messages),
              social: flag(body.social),
              campaignTypes,
            },
          },
        },
      );
      return { ok: true };
    }

    if (kind === "username") {
      const username = str(body.username).trim();
      if (!USERNAME_REGEX.test(username)) {
        return fail(400, "Entre 3 y 20 caracteres: letras, números y guion bajo (sin @ ni espacios).");
      }
      const usernameLower = username.toLowerCase();
      if (await User.exists({ usernameLower, _id: { $ne: userId } })) {
        return fail(409, "Ese nombre de usuario ya está en uso.");
      }
      await User.updateOne({ _id: userId }, { $set: { username, usernameLower } });
      return { ok: true, username };
    }

    // Contraseña y correo exigen la contraseña actual
    const user = await User.findById(userId).select("+passwordHash username email");
    if (!user || !(await bcrypt.compare(str(body.currentPassword), user.passwordHash))) {
      return fail(403, "La contraseña actual no es correcta.");
    }

    if (kind === "password") {
      const next = str(body.newPassword);
      if (next.length < 8 || next.length > 72) return fail(400, "La contraseña nueva debe tener entre 8 y 72 caracteres.");
      await User.updateOne({ _id: user._id }, { $set: { passwordHash: await bcrypt.hash(next, 10) } });
      return { ok: true };
    }

    if (kind === "email") {
      const newEmail = str(body.newEmail).trim().toLowerCase();
      if (!EMAIL_REGEX.test(newEmail) || newEmail.length > 254) return fail(400, "Escribe un correo electrónico válido.");
      if (user.email === newEmail) return fail(400, "Ese ya es tu correo actual.");
      if (await User.exists({ email: newEmail })) return fail(409, "Ya existe una cuenta con ese correo.");

      // El correo no cambia hasta que se pulse el enlace enviado a la dirección NUEVA
      const { token, hash, expires } = createVerificationToken();
      await User.updateOne(
        { _id: user._id },
        { $set: { pendingEmail: newEmail, verifyTokenHash: hash, verifyTokenExpires: expires } },
      );
      try {
        await sendVerificationEmail(newEmail, user.username, token);
      } catch (mailErr) {
        console.error("No se pudo enviar el correo de confirmación:", mailErr);
        await User.updateOne(
          { _id: user._id },
          { $unset: { pendingEmail: "", verifyTokenHash: "", verifyTokenExpires: "" } },
        );
        return fail(502, "No se pudo enviar el correo de confirmación. Inténtalo de nuevo en unos minutos.");
      }
      return { ok: true, pendingEmail: newEmail };
    }

    return fail(400, "Acción no válida.");
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return fail(409, "Ese dato ya está en uso.");
    console.error("Error al actualizar la cuenta:", err);
    return fail(500, "No se pudo guardar el cambio. Inténtalo de nuevo.");
  }
}

// Borrar la cuenta: exige la contraseña y escribir el nombre de usuario
export async function deleteAccount(userId: string, password: string, confirmUsername: string): Promise<Result> {
  await connectDB();
  const user = await User.findById(userId).select("+passwordHash username");
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return fail(403, "La contraseña no es correcta.");
  }
  if (confirmUsername.trim() !== user.username) return fail(400, "El nombre de usuario escrito no coincide.");

  try {
    await deleteUserData(userId);
    return { ok: true };
  } catch (err) {
    console.error("Error al borrar la cuenta:", err);
    return fail(500, "No se pudo borrar la cuenta. Inténtalo de nuevo.");
  }
}
