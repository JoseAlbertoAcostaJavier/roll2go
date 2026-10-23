import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Character } from "@/lib/Character";
import { OUTDATED_SHEET_ERROR, loadCharacterFor } from "@/lib/characterAccess";
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
  if (found.outdated) return NextResponse.json({ error: OUTDATED_SHEET_ERROR }, { status: 409 });

  const max = derive(found.sheet, found.entries).hp.max;
  const result = applyHp(found.sheet, body, max);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Solo los PG: así no pisa otros cambios de la hoja hechos a la vez
  const res = await Character.updateOne({ _id: id, "sheet.version": 2 }, { $set: { "sheet.hp": result.sheet.hp } });
  if (res.matchedCount === 0) return NextResponse.json({ error: OUTDATED_SHEET_ERROR }, { status: 409 });
  return NextResponse.json({ hp: derive(result.sheet, found.entries).hp });
}
