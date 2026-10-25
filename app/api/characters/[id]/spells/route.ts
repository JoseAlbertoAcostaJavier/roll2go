import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { applySpellOperation } from "@/lib/server/characters/sheetEdits";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ id: string }> };

// Una operación de conjuros (spec de conjuros §2.5): { op: "prepare" | "unprepare", class, ref }, { op: "copy", ref },
// { op: "slot", level, used }, { op: "longRest" }, { op: "shortRest" }, { op: "setOption", subclass, name } (la tierra
// del Círculo de la Tierra; `name: null` la quita), { op: "limited", key, used } (usos de un conjuro por descanso largo) o
// { op: "setMastery", level, ref } (Dominio de conjuros; `ref: null` lo quita). Solo el dueño. Se comprueba sobre lo
// guardado y solo se escribe si ese campo sigue igual, así nunca se supera el límite con peticiones a la vez.
// Responde { spells } recalculado.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  // Cubo propio: gastar espacios y preparar en partida son muchas peticiones seguidas
  const limited = await rateLimit("character_spells", session.id, 600, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const result = await applySpellOperation(session.id, id, body);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ spells: result.spells });
}
