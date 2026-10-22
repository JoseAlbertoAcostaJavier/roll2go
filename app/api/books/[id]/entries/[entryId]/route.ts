import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { BookEntry } from "@/lib/BookEntry";
import { MAX_BOOK_NAME, MAX_ENTRY_DESCRIPTION, loadBook } from "@/lib/bookAccess";
import { cleanText } from "@/lib/utils";
import { normalizeName } from "@/lib/rules/schemas";

type Ctx = { params: Promise<{ id: string; entryId: string }> };

const notFound = () => NextResponse.json({ error: "No encontrado." }, { status: 404 });

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id, entryId } = await params;
  const session = await sessionOf(req);
  if (!mongoose.isValidObjectId(entryId)) return notFound();
  const found = await loadBook(id, session?.id ?? null);
  if (!found) return notFound();
  const entry = await BookEntry.findOne({ _id: entryId, book: id }).lean();
  if (!entry) return notFound();
  return NextResponse.json({ entry, canEdit: found.canEdit });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id, entryId } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });

  const limited = await rateLimit("book_entry", session.id, 300, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  if (!mongoose.isValidObjectId(entryId)) return notFound();
  const found = await loadBook(id, session.id);
  if (!found?.canEdit) return notFound();

  const body = await req.json().catch(() => null);
  const update: Record<string, unknown> = {};
  if (typeof body?.name === "string") {
    const name = cleanText(body.name).replace(/\s+/g, " ").trim();
    if (!name || name.length > MAX_BOOK_NAME)
      return NextResponse.json({ error: "Nombre no válido." }, { status: 400 });
    update.name = name;
    update.nameLower = normalizeName(name);
  }
  if (typeof body?.description === "string")
    update.description = cleanText(body.description).slice(0, MAX_ENTRY_DESCRIPTION);
  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "No hay nada que guardar." }, { status: 400 });

  const res = await BookEntry.updateOne({ _id: entryId, book: id }, { $set: update });
  if (!res.matchedCount) return notFound();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id, entryId } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  if (!mongoose.isValidObjectId(entryId)) return notFound();
  const found = await loadBook(id, session.id);
  if (!found?.canEdit) return notFound();
  await BookEntry.deleteOne({ _id: entryId, book: id });
  return NextResponse.json({ ok: true });
}
