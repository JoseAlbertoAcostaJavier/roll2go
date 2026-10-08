import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/User";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { createVerificationToken, VERIFY_TTL_MS } from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/mail";

const COOLDOWN_MS = 60 * 1000; // mínimo entre dos envíos al mismo correo

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

  try {
    await connectDB();
    const user = await User.findOne({ email, verified: { $ne: true } }).select(
      "+verifyTokenExpires",
    );

    if (user) {
      // El momento del último envío se deduce de la caducidad del token anterior
      const lastSent = user.verifyTokenExpires
        ? user.verifyTokenExpires.getTime() - VERIFY_TTL_MS
        : 0;
      if (Date.now() - lastSent >= COOLDOWN_MS) {
        const { token, hash, expires } = createVerificationToken();
        // Al guardar uno nuevo, el enlace anterior deja de valer
        await User.updateOne(
          { _id: user._id },
          { $set: { verifyTokenHash: hash, verifyTokenExpires: expires } },
        );
        await sendVerificationEmail(user.email, user.username, token);
      }
    }

    // Siempre la misma respuesta, exista la cuenta o no
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al reenviar la verificación:", err);
    return NextResponse.json(
      {
        error:
          "No se pudo enviar el correo. Inténtalo de nuevo en unos minutos.",
      },
      { status: 500 },
    );
  }
}
