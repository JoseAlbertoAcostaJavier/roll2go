import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { levelUp } from "@/lib/server/characters/levels";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ id: string }> };

// Sube un nivel { expectedLevel, class, choices, hp }. Solo el dueño. Responde 201 { level } o 400 { errors } con los
// errores por campo; 409 si el personaje ya cambió de nivel. Avisa al DM si el personaje está en su campaña.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("character_level", session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const result = await levelUp(session.id, id, body);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ level: result.level }, { status: 201 });
}
