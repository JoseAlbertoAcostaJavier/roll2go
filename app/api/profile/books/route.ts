import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { ownedBooksOf, setOwnedBooks } from "@/lib/server/account/profile";

export async function GET(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json(
      { error: "No has iniciado sesión." },
      { status: 401 },
    );
  return NextResponse.json({ ownedBooks: await ownedBooksOf(session.id) });
}

// Sustituye la lista de libros del usuario. Solo se aceptan ids de libros oficiales existentes.
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

  const requested = Array.isArray(body.ownedBooks)
    ? [...new Set(body.ownedBooks.filter((id): id is string => typeof id === "string"))]
    : [];
  return NextResponse.json({ ownedBooks: await setOwnedBooks(session.id, requested) });
}
