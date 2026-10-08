import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/User";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { hashToken } from "@/lib/verification";

export async function POST(req: NextRequest) {
  const limited = await rateLimit("verify", getClientIp(req), 30, 15 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  // El token son 32 bytes en hexadecimal (64 caracteres)
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json(
      { error: "El enlace no es válido.", code: "invalid" },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const hash = hashToken(token);

    // Operación atómica: solo un clic puede gastar el token, y solo si no ha caducado
    const verified = await User.findOneAndUpdate(
      { verifyTokenHash: hash, verifyTokenExpires: { $gt: new Date() } },
      {
        $set: { verified: true },
        $unset: { verifyTokenHash: "", verifyTokenExpires: "" },
      },
    );
    if (verified) return NextResponse.json({ ok: true });

    // No ha servido: ¿ha caducado, o no existe / ya se usó?
    const expired = await User.findOne({ verifyTokenHash: hash }).select(
      "email",
    );
    if (expired) {
      return NextResponse.json(
        {
          error: "El enlace ha caducado. Pide uno nuevo.",
          code: "expired",
          email: expired.email,
        },
        { status: 410 },
      );
    }
    return NextResponse.json(
      {
        error:
          "El enlace no es válido o ya se ha usado. Si ya verificaste tu cuenta, inicia sesión.",
        code: "invalid",
      },
      { status: 400 },
    );
  } catch (err) {
    console.error("Error al verificar la cuenta:", err);
    return NextResponse.json(
      { error: "No se pudo verificar la cuenta. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
