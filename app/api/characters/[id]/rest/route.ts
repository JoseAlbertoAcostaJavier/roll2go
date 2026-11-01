import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { applyRestOperation } from "@/lib/server/characters/sheetEdits";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ id: string }> };

// Un descanso (spec del descanso corto §4): { op: "longRest" } o { op: "shortRest", spend?, healing? } (dados de golpe
// gastados por clase y, si se tiró fuera, el total curado). Solo el dueño. Las tiradas las hace el servidor.
// Responde { ok: true, healed, rolls }.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("sheet_rest", session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const result = await applyRestOperation(session.id, id, body);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true, healed: result.healed, rolls: result.rolls });
}
