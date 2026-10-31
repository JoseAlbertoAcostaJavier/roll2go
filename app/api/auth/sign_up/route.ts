import { NextRequest, NextResponse } from "next/server";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { registerUser } from "@/lib/server/auth/credentials";
import { failureResponse } from "@/lib/server/result";

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

  // Crea la cuenta y envía el correo de verificación, sin iniciar la sesión
  const result = await registerUser({ username, email, password });
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ success: true }, { status: 201 });
}
