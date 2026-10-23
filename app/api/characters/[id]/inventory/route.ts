import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Character } from "@/lib/Character";
import { loadCharacterFor } from "@/lib/characterAccess";
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

  // Objetos que puede ver la operación: los del inventario y, al añadir, el pedido (si es de un libro usable y es un objeto)
  const items = new Map<string, CatalogEntry>();
  const isItem = (e: CatalogEntry | null): e is CatalogEntry => !!e && e.ref.key.startsWith("item:");
  const wanted: Ref[] = found.sheet.inventory.items.flatMap((i) => (i.ref ? [i.ref] : []));
  const added = (body as { ref?: { book?: unknown; key?: unknown } } | null)?.ref;
  if (added && typeof added.book === "string" && typeof added.key === "string") wanted.push({ book: added.book, key: added.key });
  await Promise.all(
    wanted.map(async (r) => {
      const entry = await resolveRef(r, found.books);
      if (isItem(entry)) items.set(refKey(r), entry);
    }),
  );

  const result = applyInventoryOp(
    found.sheet,
    body,
    (r) => items.get(refKey(r)) ?? null,
    () => new mongoose.Types.ObjectId().toHexString(),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await Character.updateOne({ _id: id }, { $set: { sheet: result.sheet } });
  return NextResponse.json({ inventory: result.sheet.inventory });
}
