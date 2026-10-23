import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Character } from "@/lib/Character";
import { OUTDATED_SHEET_ERROR, loadCharacterFor } from "@/lib/characterAccess";
import { resolveRef, type CatalogEntry } from "@/lib/rules/catalog";
import { applyInventoryOp } from "@/lib/rules/dnd2024/edits";
import { refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import type { Ref } from "@/lib/rules/types";

type Ctx = { params: Promise<{ id: string }> };

// Una operación por petición: add, update, remove, coins u other. Solo el dueño; responde { inventory } completo.
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

  // Objetos que puede ver la operación: los del inventario (ya cargados con la hoja) y, al añadir, el pedido (si es
  // de un libro usable y es un objeto)
  const isItem = (e: CatalogEntry | null | undefined): e is CatalogEntry => !!e && e.ref.key.startsWith("item:");
  const items = new Map([...found.entries].filter(([, e]) => isItem(e)));
  const added = (body as { ref?: { book?: unknown; key?: unknown } } | null)?.ref;
  if (added && typeof added.book === "string" && typeof added.key === "string") {
    const r: Ref = { book: added.book, key: added.key };
    if (!items.has(refKey(r))) {
      const entry = await resolveRef(r, found.books);
      if (isItem(entry)) items.set(refKey(r), entry);
    }
  }

  const result = applyInventoryOp(
    found.sheet,
    body,
    (r) => items.get(refKey(r)) ?? null,
    () => new mongoose.Types.ObjectId().toHexString(),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Solo el inventario: así no pisa otros cambios de la hoja hechos a la vez
  const res = await Character.updateOne(
    { _id: id, "sheet.version": 2 },
    { $set: { "sheet.inventory": result.sheet.inventory } },
  );
  if (res.matchedCount === 0) return NextResponse.json({ error: OUTDATED_SHEET_ERROR }, { status: 409 });
  return NextResponse.json({ inventory: result.sheet.inventory });
}
