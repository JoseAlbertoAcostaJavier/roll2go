import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/campaignApi";
import { ENTRY_KINDS } from "@/lib/BookEntry";
import { NotFoundError, listEntries, usableBooks } from "@/lib/rules/catalog";
import type { EntryKind } from "@/lib/rules/types";

const MAX_Q = 80;

// ?kind=species&system=dnd-2024&campaign=<id>&books=a,b&parent=<clave>&q=draco
export async function GET(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") ?? "";
  if (!(ENTRY_KINDS as readonly string[]).includes(kind))
    return NextResponse.json({ error: "Tipo de entrada no válido." }, { status: 400 });
  const system = sp.get("system") ?? "";
  if (!system) return NextResponse.json({ error: "Falta el sistema." }, { status: 400 });

  const chosen = (sp.get("books") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
  try {
    // El servidor recalcula los libros permitidos: lo que venga ajeno en `books` se ignora
    const books = await usableBooks({
      userId: session.id,
      systemId: system,
      campaignId: sp.get("campaign") || undefined,
      chosenBooks: chosen,
    });
    const entries = await listEntries({
      books,
      kind: kind as EntryKind,
      parent: (sp.get("parent") ?? "").slice(0, 200) || undefined,
      q: (sp.get("q") ?? "").slice(0, MAX_Q),
    });
    return NextResponse.json({ entries });
  } catch (e) {
    if (e instanceof NotFoundError)
      return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
