import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Character } from "@/lib/Character";
import { OUTDATED_SHEET_ERROR, loadCharacterFor } from "@/lib/characterAccess";
import { getEntries } from "@/lib/rules/catalog";
import { derive } from "@/lib/rules/dnd2024/derive";
import { removeLastLevel } from "@/lib/rules/dnd2024/levelOps";
import { loadSheetEntries } from "@/lib/rules/dnd2024/sheetEntries";

type Ctx = { params: Promise<{ id: string }> };

// Borra el último nivel. Solo el dueño. Responde { ok: true } o 400 { error } (el nivel 1 no se borra).
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("character_level", session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const found = await loadCharacterFor(session.id, id, "write");
  if (!found) return NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });
  if (found.outdated) return NextResponse.json({ error: OUTDATED_SHEET_ERROR }, { status: 409 });

  const before = found.sheet.levels.length;
  // Sin el último nivel: el máximo de PG se calcula con la hoja ya recortada
  const probe = removeLastLevel(found.sheet, 0);
  if (!probe.ok) return NextResponse.json({ error: probe.error }, { status: 400 });
  const entriesAfter = await loadSheetEntries(probe.sheet, found.books, getEntries);
  const maxAfter = derive(probe.sheet, entriesAfter).hp.max;
  const result = removeLastLevel(found.sheet, maxAfter);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Solo lo que cambia, y solo si nadie ha cambiado de nivel entretanto
  const set: Record<string, unknown> = { "sheet.classesSummary": result.sheet.classesSummary, "sheet.hp.current": result.sheet.hp.current };
  if (result.sheet.weaponMasteries && result.sheet.weaponMasteries.length !== found.sheet.weaponMasteries?.length) set["sheet.weaponMasteries"] = result.sheet.weaponMasteries;
  const res = await Character.updateOne(
    { _id: id, "sheet.version": 2, "sheet.levels": { $size: before } },
    { $set: set, $pop: { "sheet.levels": 1 } },
  );
  if (res.matchedCount === 0)
    return NextResponse.json({ error: "El personaje ha cambiado de nivel; recarga la página." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
