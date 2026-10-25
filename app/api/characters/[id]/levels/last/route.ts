import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { deleteLastLevel } from "@/lib/server/characters/levels";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ id: string }> };

// Borra el último nivel. Solo el dueño. Responde { ok: true } o 400 { error } (el nivel 1 no se borra).
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("character_level", session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const result = await deleteLastLevel(session.id, id);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
