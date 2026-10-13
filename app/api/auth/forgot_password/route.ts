import { after, NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/User";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { createResetToken } from "@/lib/verification";
import { sendPasswordResetEmail } from "@/lib/mail";

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

  try {
    await connectDB();
    const user = await User.findOne({ email });

    // Por seguridad (anti-enumeración): Devolver 200 OK aunque el usuario no exista
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Generar y guardar el hash del token en el usuario
    const { token, hash, expires } = createResetToken();
    user.resetTokenHash = hash;
    user.resetTokenExpires = expires;
    await user.save();

    // El correo se envía DESPUÉS de responder: así la respuesta tarda casi lo mismo exista o no la cuenta
    after(async () => {
      try {
        await sendPasswordResetEmail(user.email, user.username, token);
      } catch (err) {
        console.error("No se pudo enviar el correo de recuperación:", err);
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error en forgot_password:", err);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
