import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { rollAbilityScores } from "@/lib/rules/dnd2024/abilities";
import { signRolls } from "@/lib/rules/dnd2024/rolls";

// Genera seis tiradas de característica (4d6 sin el menor) y un token firmado para validarlas al crear el personaje
export async function POST(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("ability_rolls", session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const values = rollAbilityScores();
  return NextResponse.json({ values, token: signRolls(session.id, values) });
}
