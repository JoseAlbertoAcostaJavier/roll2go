import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { MAX_BOOK_NAME, MAX_ENTRY_DESCRIPTION, loadBook } from "@/lib/server/books/bookAccess";
import { createBookEntry, listBookEntries } from "@/lib/server/books/books";
import { failureResponse } from "@/lib/server/result";
import { cleanText } from "@/lib/utils/utils";
import { ENTRY_KINDS, type EntryKind } from "@/lib/rules/types";

type Ctx = { params: Promise<{ id: string }> };

const isKind = (k: string): k is EntryKind => (ENTRY_KINDS as readonly string[]).includes(k);

// ?kind=spell&q=bola  (q: prefijo del nombre)
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  const found = await loadBook(id, session?.id ?? null);
  if (!found) return NextResponse.json({ error: "Libro no encontrado." }, { status: 404 });

  const kind = req.nextUrl.searchParams.get("kind");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_BOOK_NAME);
  const entries = await listBookEntries(id, kind && isKind(kind) ? kind : null, q);
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });

  const limited = await rateLimit("book_entry", session.id, 300, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const found = await loadBook(id, session.id);
  if (!found?.canEdit)
    return NextResponse.json({ error: "Libro no encontrado." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const name = cleanText(String(body?.name ?? "")).replace(/\s+/g, " ").trim();
  const kind = String(body?.kind ?? "");
  if (!name || name.length > MAX_BOOK_NAME)
    return NextResponse.json({ error: `El nombre es obligatorio (máx. ${MAX_BOOK_NAME}).` }, { status: 400 });
  if (!isKind(kind))
    return NextResponse.json({ error: "Tipo de entrada no válido." }, { status: 400 });

  const result = await createBookEntry(id, {
    kind,
    name,
    description: cleanText(String(body?.description ?? "")).slice(0, MAX_ENTRY_DESCRIPTION),
  });
  if (!result.ok) return failureResponse(result);
  revalidateTag(`book:${id}`, "max");
  return NextResponse.json({ id: result.id }, { status: 201 });
}
