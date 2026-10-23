import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Character } from "@/lib/Character";
import { loadCharacterFor } from "@/lib/characterAccess";
import { derive } from "@/lib/rules/dnd2024/derive";
import { applyHp } from "@/lib/rules/dnd2024/edits";

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

  const found = await loadCharacterFor(session.id, id, "write");
  if (!found) return NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });

  const max = derive(found.sheet, found.entries).hp.max;
  const result = applyHp(found.sheet, body, max);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await Character.updateOne({ _id: id }, { $set: { sheet: result.sheet } });
  return NextResponse.json({ hp: derive(result.sheet, found.entries).hp });
}
