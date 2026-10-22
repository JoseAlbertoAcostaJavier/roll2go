import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Book } from "@/lib/Book";
import { system } from "@/lib/systems";
import { MAX_BOOKS_PER_USER, MAX_BOOK_DESCRIPTION, MAX_BOOK_NAME, cleanText } from "@/lib/bookAccess";

// Mis libros (opcional ?systemId=dnd-5)
export async function GET(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  await connectDB();
  const systemId = req.nextUrl.searchParams.get("systemId");
  const books = await Book.find({
    owner: session.id,
    ...(systemId ? { systemId } : {}),
  })
    .select("-description") // el listado no necesita el texto completo
    .sort({ updatedAt: -1 })
    .lean();
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

  await connectDB();
  if ((await Book.countDocuments({ owner: session.id })) >= MAX_BOOKS_PER_USER)
    return NextResponse.json(
      { error: `Has alcanzado el máximo de ${MAX_BOOKS_PER_USER} libros.` },
      { status: 400 },
    );

  const book = await Book.create({
    owner: session.id,
    systemId,
    name,
    description: cleanText(String(body?.description ?? "")).slice(0, MAX_BOOK_DESCRIPTION),
    language: "es",
    visibility: "private",
    license: { type: "own" }, // lo oficial/SRD nunca se crea por esta ruta
  });
  return NextResponse.json({ id: String(book._id) }, { status: 201 });
}
