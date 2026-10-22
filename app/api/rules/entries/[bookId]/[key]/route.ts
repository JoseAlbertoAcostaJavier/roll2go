import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/campaignApi";
import { booksByIds } from "@/lib/rules/books";
import { NotFoundError, resolveRef, usableBooks } from "@/lib/rules/catalog";

type Ctx = { params: Promise<{ bookId: string; key: string }> };

const notFound = () => NextResponse.json({ error: "Entrada no encontrada." }, { status: 404 });

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const { bookId, key } = await params;
  const [book] = await booksByIds([bookId]);
  if (!book) return notFound();

  try {
    const books = await usableBooks({
      userId: session.id,
      systemId: book.systemId,
      campaignId: req.nextUrl.searchParams.get("campaign") || undefined,
    });
    const entry = await resolveRef({ book: bookId, key }, books);
    return entry ? NextResponse.json({ entry }) : notFound();
  } catch (e) {
    if (e instanceof NotFoundError) return notFound();
    throw e;
  }
}
