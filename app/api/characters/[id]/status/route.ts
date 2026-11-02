import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { applyStatusOperation } from "@/lib/server/characters/sheetEdits";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ id: string }> };

// Inspiración heroica, estados y agotamiento (spec de la ficha visual §2): { op: "inspiration", value },
// { op: "condition", key, active } o { op: "exhaustion", level }. Solo el dueño. Responde { ok: true, status }.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("sheet_status", session.id, 300, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const result = await applyStatusOperation(session.id, id, body);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true, status: result.status });
}
