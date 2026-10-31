import { NextRequest, NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { joinByInviteCode } from "@/lib/server/campaigns/joinCampaign";
import { failureResponse } from "@/lib/server/result";

export async function POST(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json(
      { error: "Inicia sesión para unirte." },
      { status: 401 },
    );

  // Máximo 20 intentos por hora y por usuario (frena probar códigos al azar)
  const limited = await rateLimit("join", session.id, 20, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const result = await joinByInviteCode(session.id, code);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ id: result.id, already: result.already });
}
