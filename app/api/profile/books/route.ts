import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { sessionOf } from "@/lib/campaignApi";
import { User } from "@/lib/User";
import { officialBookIds } from "@/lib/rules/books";

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
  const ownedBooks = await officialBookIds(requested);

  await connectDB();
  await User.updateOne({ _id: session.id }, { $set: { ownedBooks } });
  return NextResponse.json({ ownedBooks });
}
