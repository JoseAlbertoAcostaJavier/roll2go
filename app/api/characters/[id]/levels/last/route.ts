import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Character } from "@/lib/Character";
import { OUTDATED_SHEET_ERROR, loadCharacterFor } from "@/lib/characterAccess";
import { getEntries } from "@/lib/rules/catalog";
import { derive } from "@/lib/rules/dnd2024/derive";
import { refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import { removeLastLevel } from "@/lib/rules/dnd2024/levelOps";
import { masteryCount } from "@/lib/rules/dnd2024/masteries";
import { loadSheetEntries } from "@/lib/rules/dnd2024/sheetEntries";
import type { SpellData } from "@/lib/rules/types";
import { unchangedFilter } from "@/lib/unchangedFilter";

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
  const derivedAfter = derive(probe.sheet, entriesAfter);
  // Maestrías que permite la hoja sin el nivel (sin tope si falta alguna clase en el catálogo)
  const classesLoaded = probe.sheet.classesSummary.every((c) => entriesAfter.has(refKey(c.class.ref)));
  // Preparados que siguen cabiendo y espacios gastados (con el nivel de cada preparado, de los libros del personaje)
  const prepared = Object.values(found.sheet.prepared ?? {}).flat().filter((r) => found.books.includes(r.book));
  const spellLevels = new Map((await getEntries(prepared)).map((e) => [refKey(e.ref), (e.data as SpellData).level]));
  const result = removeLastLevel(
    found.sheet, derivedAfter.hp.max, classesLoaded ? masteryCount(probe.sheet, entriesAfter) : Infinity,
    classesLoaded ? { ...derivedAfter.spells, spellLevel: (r) => spellLevels.get(refKey(r)) } : undefined,
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Solo lo que cambia, y solo si nadie ha cambiado de nivel entretanto
  const set: Record<string, unknown> = { "sheet.classesSummary": result.sheet.classesSummary, "sheet.hp.current": result.sheet.hp.current };
  // (borrar solo quita maestrías: si cambian, cambia su número)
  if (result.sheet.weaponMasteries && result.sheet.weaponMasteries.length !== found.sheet.weaponMasteries?.length) {
    set["sheet.weaponMasteries"] = result.sheet.weaponMasteries;
  }
  // Los conjuros, solo si nadie los ha cambiado entretanto (si no, se perdería ese cambio); los usos por descanso
  // largo, solo si la hoja los tiene
  const unchanged: Record<string, unknown> = {};
  const stored = found.character.sheet as Record<string, unknown> | undefined;
  if (classesLoaded) {
    for (const field of ["prepared", "slotsUsed", "limitedUsed"] as const) {
      if (result.sheet[field] === undefined) continue;
      set[`sheet.${field}`] = result.sheet[field];
      unchanged[`sheet.${field}`] = unchangedFilter(stored?.[field]);
    }
  }
  // La alternativa de conjuros de la subclase que daba el nivel, igual
  const options = result.sheet.spellOption;
  if (options && Object.keys(options).length !== Object.keys(found.sheet.spellOption ?? {}).length) {
    set["sheet.spellOption"] = options;
    unchanged["sheet.spellOption"] = unchangedFilter(stored?.spellOption);
  }
  const res = await Character.updateOne(
    { _id: id, "sheet.version": 2, "sheet.levels": { $size: before }, ...unchanged },
    { $set: set, $pop: { "sheet.levels": 1 } },
  );
  if (res.matchedCount === 0) {
    // Si sigue en el mismo nivel, lo que cambió entretanto fueron sus conjuros
    const sameLevel = await Character.exists({ _id: id, "sheet.version": 2, "sheet.levels": { $size: before } });
    const error = sameLevel
      ? "El personaje ha cambiado mientras borrabas el nivel. Recarga la página."
      : "El personaje ha cambiado de nivel; recarga la página.";
    return NextResponse.json({ error }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
