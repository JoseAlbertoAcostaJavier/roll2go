import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/User";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { hashToken } from "@/lib/verification";

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

  try {
    await connectDB();
    const passwordHash = await bcrypt.hash(password, 10);

    // Operación atómica: solo una petición puede gastar el token, y solo si no ha caducado.
    // verified: true -> abrir el enlace del correo demuestra que el correo es suyo.
    const user = await User.findOneAndUpdate(
      {
        resetTokenHash: hashToken(token),
        resetTokenExpires: { $gt: new Date() },
      },
      {
        $set: { passwordHash, verified: true },
        $unset: {
          resetTokenHash: "",
          resetTokenExpires: "",
          verifyTokenHash: "",
          verifyTokenExpires: "",
        },
      },
    );

    if (!user) {
      return NextResponse.json(
        { error: "El enlace es inválido o ha expirado. Pide uno nuevo." },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en reset_password:", error);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
