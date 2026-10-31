import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { loadCharacterFor } from "@/lib/server/characters/characterAccess";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { HIT_DICE, hitDieValue, signHitDie } from "@/lib/rules/dnd2024/creation/rolls";
import { MAX_LEVEL } from "@/lib/rules/dnd2024/levels/validateLevel";

// Tira un dado de golpe para el siguiente nivel de un personaje { characterId, die } (solo el dueño) y devuelve
// { value, token }: el token va ligado al usuario, al personaje y a ese nivel, y se comprueba al guardar el nivel. La
// tirada es determinista (hitDieValue): repetirla devuelve el mismo valor.
export async function POST(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("hit_die", session.id, 120, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { characterId?: unknown; die?: unknown } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  const die = body?.die;
  const characterId = body?.characterId;
  if (!HIT_DICE.includes(die as (typeof HIT_DICE)[number]) || typeof characterId !== "string") {
    return NextResponse.json({ error: "Dado de golpe no válido." }, { status: 400 });
  }

  const found = await loadCharacterFor(session.id, characterId, "write");
  if (!found) return NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });
  const n = found.sheet.levels.length + 1;
  if (n > MAX_LEVEL) return NextResponse.json({ error: `El nivel máximo es ${MAX_LEVEL}.` }, { status: 400 });

  const value = hitDieValue(session.id, characterId, n, die as number);
  return NextResponse.json({ value, token: signHitDie(session.id, { characterId, n, die: die as number, value }) });
}
