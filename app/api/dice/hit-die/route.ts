import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { HIT_DICE, rollHitDie, signHitDie } from "@/lib/rules/dnd2024/rolls";

// Tira un dado de golpe al subir de nivel y devuelve un token firmado para validar la tirada al guardar el nivel.
export async function POST(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("hit_die", session.id, 120, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { die?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  const die = body?.die;
  if (!HIT_DICE.includes(die as (typeof HIT_DICE)[number])) {
    return NextResponse.json({ error: "Dado de golpe no válido." }, { status: 400 });
  }

  const value = rollHitDie(die as number);
  return NextResponse.json({ value, token: signHitDie(session.id, die as number, value) });
}
