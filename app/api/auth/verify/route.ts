import { NextRequest, NextResponse } from "next/server";
import { verifyAccount } from "@/lib/server/auth/emailTokens";
import { failureResponse } from "@/lib/server/result";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/server/rateLimit";

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

  const result = await verifyAccount(token);
  if (!result.ok) return "body" in result ? NextResponse.json(result.body, { status: result.status }) : failureResponse(result);
  return NextResponse.json({ ok: true });
}
