import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Character } from "@/lib/Character";
import { OUTDATED_SHEET_ERROR, loadCharacterFor } from "@/lib/characterAccess";
import { getEntries } from "@/lib/rules/catalog";
import { derive } from "@/lib/rules/dnd2024/derive";
import { weaponProficient } from "@/lib/rules/dnd2024/derive/attacks";
import { bareName, isRef, refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import { masteryCount, masteryMeleeOnly, validateMasteries } from "@/lib/rules/dnd2024/masteries";
import type { ItemData } from "@/lib/rules/types";

type Ctx = { params: Promise<{ id: string }> };

const MAX_REFS = 50;

// Cambia las armas con maestría { masteries: Ref[] }. Solo el dueño. Tantas como da la progresión de sus clases;
// armas sencillas o marciales con maestría y con competencia (del Bárbaro, solo cuerpo a cuerpo). Responde
// { weaponMasteries }.
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
  const raw = typeof body === "object" && body !== null ? (body as { masteries?: unknown }).masteries : undefined;
  if (!Array.isArray(raw) || raw.length > MAX_REFS || !raw.every(isRef))
    return NextResponse.json({ error: "Maestrías no válidas." }, { status: 400 });
  const masteries = raw.map((r) => ({ book: r.book, key: r.key }));

  const found = await loadCharacterFor(session.id, id, "write");
  if (!found) return NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });
  if (found.outdated) return NextResponse.json({ error: OUTDATED_SHEET_ERROR }, { status: 409 });

  // Las armas, solo de los libros del personaje
  const entries = new Map(found.entries);
  const wanted = masteries.filter((r) => found.books.includes(r.book) && r.key.startsWith("item:"));
  for (const e of await getEntries(wanted)) entries.set(refKey(e.ref), e);

  const weapons = derive(found.sheet, found.entries).weapons;
  const result = validateMasteries(masteries, {
    allowed: masteryCount(found.sheet, entries),
    entries,
    meleeOnly: masteryMeleeOnly(found.sheet, entries),
    proficientWith: (item) => weaponProficient(item.data as ItemData, [item.name, bareName(item.ref.key)], weapons),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Solo las maestrías: así no pisa otros cambios de la hoja hechos a la vez
  const res = await Character.updateOne({ _id: id, "sheet.version": 2 }, { $set: { "sheet.weaponMasteries": masteries } });
  if (res.matchedCount === 0) return NextResponse.json({ error: OUTDATED_SHEET_ERROR }, { status: 409 });
  return NextResponse.json({ weaponMasteries: masteries });
}
