import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { MAX_BOOK_NAME, MAX_ENTRY_DESCRIPTION, loadBook } from "@/lib/server/books/bookAccess";
import { deleteBookEntry, getBookEntry, updateBookEntry } from "@/lib/server/books/books";
import { isValidId } from "@/lib/server/ids";
import { cleanText } from "@/lib/utils/utils";

type Ctx = { params: Promise<{ id: string; entryId: string }> };

const notFound = () => NextResponse.json({ error: "No encontrado." }, { status: 404 });

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id, entryId } = await params;
  const session = await sessionOf(req);
  if (!isValidId(entryId)) return notFound();
  const found = await loadBook(id, session?.id ?? null);
  if (!found) return notFound();
  const entry = await getBookEntry(id, entryId);
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

  if (!isValidId(entryId)) return notFound();
  const found = await loadBook(id, session.id);
  if (!found?.canEdit) return notFound();

  const body = await req.json().catch(() => null);
  const update: { name?: string; description?: string } = {};
  if (typeof body?.name === "string") {
    const name = cleanText(body.name).replace(/\s+/g, " ").trim();
    if (!name || name.length > MAX_BOOK_NAME)
      return NextResponse.json({ error: "Nombre no válido." }, { status: 400 });
    update.name = name;
  }
  if (typeof body?.description === "string")
    update.description = cleanText(body.description).slice(0, MAX_ENTRY_DESCRIPTION);
  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "No hay nada que guardar." }, { status: 400 });

  if (!(await updateBookEntry(id, entryId, update))) return notFound();
  revalidateTag(`book:${id}`, "max");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id, entryId } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  if (!isValidId(entryId)) return notFound();
  const found = await loadBook(id, session.id);
  if (!found?.canEdit) return notFound();
  await deleteBookEntry(id, entryId);
  revalidateTag(`book:${id}`, "max");
  return NextResponse.json({ ok: true });
}
