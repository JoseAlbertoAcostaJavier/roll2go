import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { sessionOf } from "@/lib/campaignApi";
import { User } from "@/lib/User";
import { books } from "@/lib/books";

export async function GET(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json(
      { error: "No has iniciado sesión." },
      { status: 401 },
    );
  await connectDB();
  const me = await User.findById(session.id).select("ownedBooks").lean();
  return NextResponse.json({ ownedBooks: me?.ownedBooks ?? [] });
}

// Sustituye la lista de libros del usuario. Solo se aceptan ids que existan en el catálogo.
export async function PUT(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json(
      { error: "No has iniciado sesión." },
      { status: 401 },
    );

  let body: { ownedBooks?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const valid = new Set(books.map((b) => b.id));
  const ownedBooks = Array.isArray(body.ownedBooks)
    ? [
        ...new Set(
          body.ownedBooks.filter(
            (id): id is string => typeof id === "string" && valid.has(id),
          ),
        ),
      ]
    : [];

  await connectDB();
  await User.updateOne({ _id: session.id }, { $set: { ownedBooks } });
  return NextResponse.json({ ownedBooks });
}
