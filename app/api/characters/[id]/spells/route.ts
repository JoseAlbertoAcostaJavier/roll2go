import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { Character } from "@/lib/models/Character";
import { OUTDATED_SHEET_ERROR, loadCharacterFor } from "@/lib/server/characters/characterAccess";
import { getEntries } from "@/lib/server/catalog/catalog";
import { derive } from "@/lib/rules/dnd2024/derive";
import { isRef, refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import { applySpellOp } from "@/lib/rules/dnd2024/spells/spellOps";
import { unchangedFilter } from "@/lib/utils/unchangedFilter";
import type { Ref } from "@/lib/rules/types";

type Ctx = { params: Promise<{ id: string }> };

// Si otra petición cambió el mismo campo entretanto, se vuelve a leer y a comprobar (como mucho estas veces)
const MAX_ATTEMPTS = 3;
const CHANGED_ERROR = "Los conjuros del personaje han cambiado; recarga la página.";

// Campos de la hoja que cambia cada operación (la tierra también quita de los preparados los que pasa a dar; el
// descanso largo recupera espacios y usos; el corto, los de pacto y los de los Conjuros distintivos)
type Field = keyof Pick<
  Dnd2024SheetV2, "prepared" | "spellbookExtra" | "slotsUsed" | "spellOption" | "limitedUsed" | "spellMastery"
>;
const FIELDS: Record<string, Field[]> = {
  prepare: ["prepared"], unprepare: ["prepared"], copy: ["spellbookExtra"], slot: ["slotsUsed"],
  longRest: ["slotsUsed", "limitedUsed"], shortRest: ["slotsUsed", "limitedUsed"], setOption: ["spellOption", "prepared"],
  limited: ["limitedUsed"], setMastery: ["spellMastery"],
};

// Una operación de conjuros (spec de conjuros §2.5): { op: "prepare" | "unprepare", class, ref }, { op: "copy", ref },
// { op: "slot", level, used }, { op: "longRest" }, { op: "shortRest" }, { op: "setOption", subclass, name } (la tierra
// del Círculo de la Tierra; `name: null` la quita), { op: "limited", key, used } (usos de un conjuro por descanso largo) o
// { op: "setMastery", level, ref } (Dominio de conjuros; `ref: null` lo quita). Solo el dueño. Se comprueba sobre lo
// guardado y solo se escribe si ese campo sigue igual, así nunca se supera el límite con peticiones a la vez.
// Responde { spells } recalculado.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  // Cubo propio: gastar espacios y preparar en partida son muchas peticiones seguidas
  const limited = await rateLimit("character_spells", session.id, 600, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  const op = typeof body === "object" && body !== null ? (body as { op?: unknown; ref?: unknown }) : {};
  const fields = typeof op.op === "string" && Object.hasOwn(FIELDS, op.op) ? FIELDS[op.op] : null;
  if (!fields) return NextResponse.json({ error: "Operación no válida." }, { status: 400 });

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

    // Solo los campos que cambian, si siguen como se leyeron y en el mismo nivel (los límites dependen de él)
    const stored = found.character.sheet as Record<string, unknown> | undefined;
    const res = await Character.updateOne(
      {
        _id: id, "sheet.version": 2, "sheet.levels": { $size: found.sheet.levels.length },
        ...Object.fromEntries(fields.map((f) => [`sheet.${f}`, unchangedFilter(stored?.[f])])),
      },
      { $set: Object.fromEntries(fields.filter((f) => result.sheet[f] !== undefined).map((f) => [`sheet.${f}`, result.sheet[f]])) },
    );
    if (res.matchedCount === 1) return NextResponse.json({ spells: derive(result.sheet, entries).spells });
  }
  return NextResponse.json({ error: CHANGED_ERROR }, { status: 409 });
}
