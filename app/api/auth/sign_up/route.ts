import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/User";
import { COOKIE_NAME, signSession, sessionCookieOptions } from "@/lib/auth";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  // Máximo 5 registros por hora y por IP
  const limited = await rateLimit("sign_up", getClientIp(req), 5, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { username?: unknown; email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  // El servidor repite las validaciones del formulario: no te puedes fiar del navegador
  const errors: Record<string, string> = {};
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    errors.username = "Entre 3 y 20 caracteres: letras, números y guion bajo (sin @ ni espacios).";
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

    // Comprobar si el correo o el usuario ya existen (el error sale debajo de su campo)
    const existing = await User.findOne({ $or: [{ email }, { usernameLower }] });
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

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, usernameLower, email, passwordHash });

    // Tras registrarse, el usuario entra directamente (cookie de sesión)
    const id = user._id.toString();
    const token = await signSession({ id, username: user.username }, false);
    const res = NextResponse.json({ user: { id, username: user.username } }, { status: 201 });
    res.cookies.set(COOKIE_NAME, token, sessionCookieOptions(false));
    return res;
  } catch (err) {
    // 11000 = clave duplicada: dos registros iguales llegaron casi a la vez
    if ((err as { code?: number }).code === 11000) {
      const key = (err as { keyPattern?: Record<string, unknown> }).keyPattern ?? {};
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
    return NextResponse.json({ error: "No se pudo crear la cuenta. Inténtalo de nuevo." }, { status: 500 });
  }
}