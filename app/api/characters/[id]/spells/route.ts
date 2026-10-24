import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Character } from "@/lib/Character";
import { OUTDATED_SHEET_ERROR, loadCharacterFor } from "@/lib/characterAccess";
import { getEntries } from "@/lib/rules/catalog";
import { derive } from "@/lib/rules/dnd2024/derive";
import { isRef, refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet";
import { applySpellOp } from "@/lib/rules/dnd2024/spellOps";
import type { Ref } from "@/lib/rules/types";

type Ctx = { params: Promise<{ id: string }> };

// Si otra petición cambió el mismo campo entretanto, se vuelve a leer y a comprobar (como mucho estas veces)
const MAX_ATTEMPTS = 3;
const CHANGED_ERROR = "Los conjuros del personaje han cambiado; recarga la página.";

// Campo de la hoja que cambia cada operación
const FIELDS: Record<string, keyof Pick<Dnd2024SheetV2, "prepared" | "spellbookExtra" | "slotsUsed">> = {
  prepare: "prepared", unprepare: "prepared", copy: "spellbookExtra", slot: "slotsUsed", longRest: "slotsUsed",
};

// Una operación de conjuros (spec de conjuros §2.5): { op: "prepare" | "unprepare", class, ref }, { op: "copy", ref },
// { op: "slot", level, used } o { op: "longRest" }. Solo el dueño. Se comprueba sobre lo guardado y solo se escribe si
// ese campo sigue igual, así nunca se supera el límite con peticiones a la vez. Responde { spells } recalculado.
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
  const op = typeof body === "object" && body !== null ? (body as { op?: unknown; ref?: unknown }) : {};
  const field = typeof op.op === "string" && Object.hasOwn(FIELDS, op.op) ? FIELDS[op.op] : null;
  if (!field) return NextResponse.json({ error: "Operación no válida." }, { status: 400 });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const found = await loadCharacterFor(session.id, id, "write");
    if (!found) return NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });
    if (found.outdated) return NextResponse.json({ error: OUTDATED_SHEET_ERROR }, { status: 409 });

    // El conjuro de la operación, solo de los libros del personaje
    const entries = new Map(found.entries);
    if (isRef(op.ref) && found.books.includes(op.ref.book) && op.ref.key.startsWith("spell:")) {
      for (const e of await getEntries([{ book: op.ref.book, key: op.ref.key }])) entries.set(refKey(e.ref), e);
    }
    const { blocks, slots } = derive(found.sheet, entries).spells;
    const resolve = (r: Ref) => (found.books.includes(r.book) ? (entries.get(refKey(r)) ?? null) : null);
    const result = applySpellOp(found.sheet, body, { blocks, slots, resolve });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    // Solo el campo que cambia, si sigue como se leyó y en el mismo nivel (los límites dependen de él)
    const stored = (found.character.sheet as Record<string, unknown> | undefined)?.[field];
    const res = await Character.updateOne(
      {
        _id: id, "sheet.version": 2, "sheet.levels": { $size: found.sheet.levels.length },
        // Con $eq: Mongoose convierte un array suelto en $in (spellbookExtra: [] no coincidiría nunca)
        [`sheet.${field}`]: stored === undefined ? { $exists: false } : { $eq: stored },
      },
      { $set: { [`sheet.${field}`]: result.sheet[field] } },
    );
    if (res.matchedCount === 1) return NextResponse.json({ spells: derive(result.sheet, entries).spells });
  }
  return NextResponse.json({ error: CHANGED_ERROR }, { status: 409 });
}
