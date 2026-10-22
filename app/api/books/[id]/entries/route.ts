import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { BookEntry, ENTRY_KINDS } from "@/lib/BookEntry";
import { MAX_BOOK_NAME, MAX_ENTRIES_PER_BOOK, MAX_ENTRY_DESCRIPTION, loadBook } from "@/lib/bookAccess";
import { cleanText, escapeRegex } from "@/lib/utils";
import { normalizeName } from "@/lib/rules/schemas";

type Ctx = { params: Promise<{ id: string }> };

const isKind = (k: string) => (ENTRY_KINDS as readonly string[]).includes(k);

// ?kind=spell&q=bola  (q: prefijo del nombre)
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  const found = await loadBook(id, session?.id ?? null);
  if (!found) return NextResponse.json({ error: "Libro no encontrado." }, { status: 404 });

  const kind = req.nextUrl.searchParams.get("kind");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_BOOK_NAME);
  const filter: Record<string, unknown> = { book: id };
  const qNorm = normalizeName(q);
  if (kind && isKind(kind)) filter.kind = kind;
  if (qNorm) filter.nameLower = { $regex: "^" + escapeRegex(qNorm) };

  const entries = await BookEntry.find(filter)
    .select("-description") // el listado no necesita el texto completo
    .sort({ kind: 1, nameLower: 1 })
    .limit(500)
    .lean();
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

  if ((await BookEntry.countDocuments({ book: id })) >= MAX_ENTRIES_PER_BOOK)
    return NextResponse.json(
      { error: `Un libro admite como máximo ${MAX_ENTRIES_PER_BOOK} entradas.` },
      { status: 400 },
    );

  const entry = await BookEntry.create({
    book: id,
    kind,
    name,
    // La clave de una entrada de usuario solo debe ser única dentro de su libro.
    // Clave estable por libro; para entradas de usuario se genera con un sufijo único
    key: `${normalizeName(name).replace(/\s+/g, "-")}|${new mongoose.Types.ObjectId().toHexString()}`,
    nameLower: normalizeName(name),
    description: cleanText(String(body?.description ?? "")).slice(0, MAX_ENTRY_DESCRIPTION),
    data: {}, // fase 2: aquí irá la validación por tipo
  });
  return NextResponse.json({ id: String(entry._id) }, { status: 201 });
}
