import { NextRequest, NextResponse } from "next/server";
import { resetPassword } from "@/lib/server/auth/emailTokens";
import { failureResponse } from "@/lib/server/result";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/server/rateLimit";

export async function POST(req: NextRequest) {
  // Máximo 10 intentos cada 15 minutos por IP
  const limited = await rateLimit("reset_pwd", getClientIp(req), 10, 15 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { token?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  // El token son 32 bytes en hexadecimal (64 caracteres), igual que en la verificación
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json(
      { error: "Enlace inválido o incompleto." },
      { status: 400 },
    );
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8 || password.length > 72) {
    return NextResponse.json(
      { error: "La contraseña debe tener entre 8 y 72 caracteres." },
      { status: 400 },
    );
  }

  const result = await resetPassword(token, password);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ success: true });
}
