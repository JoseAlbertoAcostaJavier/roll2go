import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { system } from "@/lib/utils/systems";
import { MAX_BOOK_DESCRIPTION, MAX_BOOK_NAME } from "@/lib/server/books/bookAccess";
import { createBook, listMyBooks } from "@/lib/server/books/books";
import { failureResponse } from "@/lib/server/result";
import { cleanText } from "@/lib/utils/utils";

// Mis libros (opcional ?systemId=dnd-5)
export async function GET(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  const books = await listMyBooks(session.id, req.nextUrl.searchParams.get("systemId"));
  return NextResponse.json({ books });
}

export async function POST(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });

  const limited = await rateLimit("book_create", session.id, 20, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const body = await req.json().catch(() => null);
  const name = cleanText(String(body?.name ?? "")).replace(/\s+/g, " ").trim();
  const systemId = String(body?.systemId ?? "");
  if (!name || name.length > MAX_BOOK_NAME)
    return NextResponse.json({ error: `El nombre es obligatorio (máx. ${MAX_BOOK_NAME}).` }, { status: 400 });
  if (!system.some((s) => s.id === systemId))
    return NextResponse.json({ error: "Sistema no válido." }, { status: 400 });

  const result = await createBook(session.id, {
    name,
    systemId,
    description: cleanText(String(body?.description ?? "")).slice(0, MAX_BOOK_DESCRIPTION),
  });
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ id: result.id }, { status: 201 });
}
