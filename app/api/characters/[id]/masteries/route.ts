import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { saveMasteries } from "@/lib/server/characters/sheetEdits";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ id: string }> };

// Cambia las armas con maestría { masteries: Ref[] }. Solo el dueño. Tantas como da la progresión de sus clases;
// armas sencillas o marciales con maestría y con competencia (del Bárbaro, solo cuerpo a cuerpo). Responde
// { weaponMasteries }.
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

  const result = await saveMasteries(session.id, id, body);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ weaponMasteries: result.weaponMasteries });
}
