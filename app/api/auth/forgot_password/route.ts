import { after, NextRequest, NextResponse } from "next/server";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { requestPasswordReset } from "@/lib/server/auth/emailTokens";
import { sendPasswordResetEmail } from "@/lib/server/notifications/mail";
import { failureResponse } from "@/lib/server/result";

export async function POST(req: NextRequest) {
  // Límite más estricto: 3 peticiones por hora para evitar spam masivo de correos
  const limited = await rateLimit("forgot_pwd", getClientIp(req), 3, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Correo electrónico no válido." },
      { status: 400 },
    );
    // Y máximo 3 por hora para el mismo correo (evita llenar la bandeja de otra persona desde varias IP)
    const byEmail = await rateLimit("forgot_pwd_email", email, 3, 60 * 60);
    if (!byEmail.ok) return tooManyRequests(byEmail.retryAfter);
  }

  // Por seguridad (anti-enumeración): 200 OK aunque el usuario no exista
  const result = await requestPasswordReset(email);
  if (!result.ok) return failureResponse(result);

  // El correo se envía DESPUÉS de responder: así la respuesta tarda casi lo mismo exista o no la cuenta
  const { mail } = result;
  if (mail) {
    after(async () => {
      try {
        await sendPasswordResetEmail(mail.email, mail.username, mail.token);
      } catch (err) {
        console.error("No se pudo enviar el correo de recuperación:", err);
      }
    });
  }

  return NextResponse.json({ success: true });
}
