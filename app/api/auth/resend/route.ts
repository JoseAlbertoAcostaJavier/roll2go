import { NextRequest, NextResponse } from "next/server";
import { resendVerification } from "@/lib/server/auth/emailTokens";
import { failureResponse } from "@/lib/server/result";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";

//Permite pedir otro enlace.
//Espera 1 minuto entre dos envios al mismo correo. Crea un token nuevo y lo guarda encima del anterior
export async function POST(req: NextRequest) {
  // Máximo 5 peticiones cada 15 minutos por IP
  const limited = await rateLimit("resend", getClientIp(req), 5, 15 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Escribe un correo electrónico válido." },
      { status: 400 },
    );
  }

  // Y máximo 3 por hora para el mismo correo (evita que alguien llene la bandeja de otra persona)
  const byEmail = await rateLimit("resend_email", email, 3, 60 * 60);
  if (!byEmail.ok) return tooManyRequests(byEmail.retryAfter);

  // Siempre la misma respuesta, exista la cuenta o no
  const result = await resendVerification(email);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
