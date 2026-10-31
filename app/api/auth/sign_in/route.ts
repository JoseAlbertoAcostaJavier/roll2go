import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, signSession, sessionCookieOptions } from "@/lib/server/auth/auth";
import { signIn } from "@/lib/server/auth/credentials";
import { failureResponse } from "@/lib/server/result";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/server/rateLimit";

export async function POST(req: NextRequest) {
  // Máximo 10 intentos cada 15 minutos por IP
  const limited = await rateLimit("sign_in", getClientIp(req), 10, 15 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { identifier?: unknown; password?: unknown; remember?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const remember = body.remember === true;

  if (!identifier || !password) {
    return NextResponse.json({ error: "Rellena tu correo o usuario y la contraseña." }, { status: 400 });
  }

  // Comprueba la contraseña, el baneo y la verificación
  const result = await signIn(identifier, password);
  if (!result.ok) return "body" in result ? NextResponse.json(result.body, { status: result.status }) : failureResponse(result);

  try {
    // Crear sesión, firmar JWT e inyectar la cookie en la respuesta
    const { id, username } = result;
    const token = await signSession({ id, username }, remember);
    const res = NextResponse.json({ user: { id, username } });
    res.cookies.set(COOKIE_NAME, token, sessionCookieOptions(remember));
    return res;
  } catch (err) {
    console.error("Error al iniciar sesión:", err);
    return NextResponse.json({ error: "No se pudo iniciar sesión. Inténtalo de nuevo." }, { status: 500 });
  }
}
