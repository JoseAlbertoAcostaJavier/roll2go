import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { COOKIE_NAME } from "@/lib/auth";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { User } from "@/lib/User";
import { createVerificationToken } from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/mail";
import { deleteUserData } from "@/lib/accountCleanup";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const bad = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });
const str = (v: unknown) => (typeof v === "string" ? v : "");

// Veces permitidas y ventana en segundos, por tipo de cambio
const LIMITS: Record<string, [number, number]> = {
  username: [5, 24 * 3600],
  password: [10, 3600],
  email: [5, 3600],
  notifications: [30, 3600],
};

export async function PATCH(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session) return bad("Inicia sesión.", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Petición no válida.");
  }

  const kind = str(body.kind);
  const limit = LIMITS[kind];
  if (!limit) return bad("Acción no válida.");
  const limited = await rateLimit(
    `account_${kind}`,
    session.id,
    limit[0],
    limit[1],
  );
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  await connectDB();
  try {
    if (kind === "notifications") {
      const flag = (v: unknown) => v === true;
      await User.updateOne(
        { _id: session.id },
        {
          $set: {
            emailPrefs: {
              campaigns: flag(body.campaigns),
              messages: flag(body.messages),
              social: flag(body.social),
            },
          },
        },
      );
      return NextResponse.json({ ok: true });
    }

    if (kind === "username") {
      const username = str(body.username).trim();
      if (!USERNAME_REGEX.test(username)) {
        return bad(
          "Entre 3 y 20 caracteres: letras, números y guion bajo (sin @ ni espacios).",
        );
      }
      const usernameLower = username.toLowerCase();
      if (await User.exists({ usernameLower, _id: { $ne: session.id } })) {
        return bad("Ese nombre de usuario ya está en uso.", 409);
      }
      await User.updateOne(
        { _id: session.id },
        { $set: { username, usernameLower } },
      );
      return NextResponse.json({ username });
    }

    // Contraseña y correo exigen la contraseña actual
    const user = await User.findById(session.id).select(
      "+passwordHash username email",
    );
    if (
      !user ||
      !(await bcrypt.compare(str(body.currentPassword), user.passwordHash))
    ) {
      return bad("La contraseña actual no es correcta.", 403);
    }

    if (kind === "password") {
      const next = str(body.newPassword);
      if (next.length < 8 || next.length > 72)
        return bad("La contraseña nueva debe tener entre 8 y 72 caracteres.");
      await User.updateOne(
        { _id: user._id },
        { $set: { passwordHash: await bcrypt.hash(next, 10) } },
      );
      return NextResponse.json({ ok: true });
    }

    if (kind === "email") {
      const newEmail = str(body.newEmail).trim().toLowerCase();
      if (!EMAIL_REGEX.test(newEmail) || newEmail.length > 254)
        return bad("Escribe un correo electrónico válido.");
      if (user.email === newEmail) return bad("Ese ya es tu correo actual.");
      if (await User.exists({ email: newEmail }))
        return bad("Ya existe una cuenta con ese correo.", 409);

      // El correo no cambia hasta que se pulse el enlace enviado a la dirección NUEVA
      const { token, hash, expires } = createVerificationToken();
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            pendingEmail: newEmail,
            verifyTokenHash: hash,
            verifyTokenExpires: expires,
          },
        },
      );
      try {
        await sendVerificationEmail(newEmail, user.username, token);
      } catch (mailErr) {
        console.error("No se pudo enviar el correo de confirmación:", mailErr);
        await User.updateOne(
          { _id: user._id },
          {
            $unset: {
              pendingEmail: "",
              verifyTokenHash: "",
              verifyTokenExpires: "",
            },
          },
        );
        return bad(
          "No se pudo enviar el correo de confirmación. Inténtalo de nuevo en unos minutos.",
          502,
        );
      }
      return NextResponse.json({ pendingEmail: newEmail });
    }

    return bad("Acción no válida.");
  } catch (err) {
    if ((err as { code?: number }).code === 11000)
      return bad("Ese dato ya está en uso.", 409);
    console.error("Error al actualizar la cuenta:", err);
    return bad("No se pudo guardar el cambio. Inténtalo de nuevo.", 500);
  }
}

// BORRAR LA CUENTA: exige la contraseña y escribir el nombre de usuario
export async function DELETE(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session) return bad("Inicia sesión.", 401);

  const limited = await rateLimit("account_delete", session.id, 5, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Petición no válida.");
  }

  await connectDB();
  const user = await User.findById(session.id).select("+passwordHash username");
  if (!user || !(await bcrypt.compare(str(body.password), user.passwordHash))) {
    return bad("La contraseña no es correcta.", 403);
  }
  if (str(body.confirmUsername).trim() !== user.username) {
    return bad("El nombre de usuario escrito no coincide.");
  }

  try {
    await deleteUserData(session.id);
  } catch (err) {
    console.error("Error al borrar la cuenta:", err);
    return bad("No se pudo borrar la cuenta. Inténtalo de nuevo.", 500);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
