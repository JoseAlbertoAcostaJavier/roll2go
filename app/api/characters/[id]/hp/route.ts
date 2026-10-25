import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { saveHp } from "@/lib/server/characters/sheetEdits";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ id: string }> };

// Edita los PG actuales y temporales { current?, temp? }. Solo el dueño; responde { hp } con los tres valores.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("character_edit", session.id, 300, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const result = await saveHp(session.id, id, body);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ hp: result.hp });
}
