import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/User";
import { BannedEmail } from "@/lib/BannedEmail";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { createVerificationToken } from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/mail";

export async function POST(req: NextRequest) {
  // Máximo 10 registros por hora y por IP
  const limited = await rateLimit("sign_up", getClientIp(req), 10, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { username?: unknown; email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  // El servidor repite las validaciones del formulario
  const errors: Record<string, string> = {};
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    errors.username =
      "Entre 3 y 20 caracteres: letras, números y guion bajo (sin @ ni espacios).";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    errors.email = "Escribe un correo electrónico válido.";
  }
  if (password.length < 8 || password.length > 72) {
    errors.password = "La contraseña debe tener entre 8 y 72 caracteres.";
  }
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    await connectDB();
    const usernameLower = username.toLowerCase();

    // Un correo baneado no puede crear otra cuenta
    if (await BannedEmail.exists({ email })) {
      return NextResponse.json(
        { errors: { email: "Este correo no puede usarse para registrarse en Roll2Go." } },
        { status: 403 },
      );
    }

    // Comprobar si el correo o el usuario ya existen
    const existing = await User.findOne({
      $or: [{ email }, { usernameLower }],
    });
    if (existing) {
      return NextResponse.json(
        {
          errors:
            existing.email === email
              ? { email: "Ya existe una cuenta con ese correo." }
              : { username: "Ese nombre de usuario ya está en uso." },
        },
        { status: 409 },
      );
    }
//Guarda la contraseña con Coste 10.
    const passwordHash = await bcrypt.hash(password, 10);

    // 1. Instanciamos el nuevo usuario. Verified es falso por defecto, y verifyTokenHash y verifyTokenExpires se rellenarán más abajo.
    const newUser = new User({
      username,
      usernameLower,
      email,
      passwordHash,
    });

    // 2. Generamos el token de verificación y lo guardamos en el modelo
    const { token, hash, expires } = createVerificationToken();
    newUser.verifyTokenHash = hash;
    newUser.verifyTokenExpires = expires;

    await newUser.save();

    // 3. Enviamos el correo. Si falla, se deshace el registro para que pueda volver a intentarlo
    //    con el mismo nombre y correo.
    try {
      await sendVerificationEmail(newUser.email, newUser.username, token);
    } catch (mailErr) {
      console.error("No se pudo enviar el correo de verificación:", mailErr);
      await User.deleteOne({ _id: newUser._id });
      return NextResponse.json(
        {
          error:
            "No se pudo enviar el correo de verificación. Inténtalo de nuevo en unos minutos.",
        },
        { status: 502 },
      );
    }

    // 4. Respondemos con éxito sin iniciar la sesión
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    // 11000 significa clave duplicada en MongoDB
    if ((err as { code?: number }).code === 11000) {
      const key =
        (err as { keyPattern?: Record<string, unknown> }).keyPattern ?? {};
      return NextResponse.json(
        {
          errors: key.email
            ? { email: "Ya existe una cuenta con ese correo." }
            : { username: "Ese nombre de usuario ya está en uso." },
        },
        { status: 409 },
      );
    }
    console.error("Error en el registro:", err);
    return NextResponse.json(
      { error: "No se pudo crear la cuenta. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
