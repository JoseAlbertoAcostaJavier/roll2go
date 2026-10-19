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

    const user = await User.findOne({
      verifyTokenHash: hash,
      verifyTokenExpires: { $gt: new Date() },
    }).select("+pendingEmail");
    if (user) {
      // Si hay un cambio de correo pendiente, se aplica ahora. El filtro por hash hace que solo un clic pueda gastar el token.
      const result = await User.updateOne(
        { _id: user._id, verifyTokenHash: hash },
        {
          $set: {
            verified: true,
            ...(user.pendingEmail ? { email: user.pendingEmail } : {}),
          },
          $unset: {
            verifyTokenHash: "",
            verifyTokenExpires: "",
            pendingEmail: "",
          },
        },
      );
      if (result.modifiedCount === 1) return NextResponse.json({ ok: true });
    }

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
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: "Ese correo ya está en uso por otra cuenta." },
        { status: 409 },
      );
    }
    console.error("Error al verificar la cuenta:", err);
    return NextResponse.json(
      { error: "No se pudo verificar la cuenta. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
