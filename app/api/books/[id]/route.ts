import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { MAX_BOOK_DESCRIPTION, MAX_BOOK_NAME, loadBook } from "@/lib/server/books/bookAccess";
import { deleteBook, updateBook } from "@/lib/server/books/books";
import { cleanText } from "@/lib/utils/utils";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "Libro no encontrado." }, { status: 404 });

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  const found = await loadBook(id, session?.id ?? null);
  if (!found) return notFound();
  return NextResponse.json({ book: found.book, canEdit: found.canEdit });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });

  const limited = await rateLimit("book_edit", session.id, 120, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const found = await loadBook(id, session.id);
  if (!found?.canEdit) return notFound();

  const body = await req.json().catch(() => null);
  const update: Record<string, unknown> = {};
  if (typeof body?.name === "string") {
    const name = cleanText(body.name).replace(/\s+/g, " ").trim();
    if (!name || name.length > MAX_BOOK_NAME)
      return NextResponse.json({ error: "Nombre no válido." }, { status: 400 });
    update.name = name;
  }
  if (typeof body?.description === "string")
    update.description = cleanText(body.description).slice(0, MAX_BOOK_DESCRIPTION);
  if (body?.visibility === "private" || body?.visibility === "public")
    update.visibility = body.visibility;
  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "No hay nada que guardar." }, { status: 400 });

  await updateBook(id, update);
  revalidateTag(`book:${id}`, "max");
  return NextResponse.json({ ok: true });
}

// Borra el libro y todas sus entradas
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  const found = await loadBook(id, session.id);
  if (!found?.canEdit) return notFound();

  await deleteBook(id);
  revalidateTag(`book:${id}`, "max");
  return NextResponse.json({ ok: true });
}
