import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { sessionOf } from "@/lib/campaignApi";
import { connectDB } from "@/lib/models/mongodb";
import { Book } from "@/lib/models/Book";
import { BookEntry } from "@/lib/models/BookEntry";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { generateName, nameTableFor, PRONOUNS, type Pronoun } from "@/lib/rules/dnd2024/names";
import { validateEntryData } from "@/lib/rules/schemas";
import type { NameTableData } from "@/lib/rules/types";

const SYSTEM = "dnd-2024";

// Tablas de nombres de un libro (las de la Guía de Xanathar); cambian solo al reimportar
const bookNameTables = (bookId: string) =>
  unstable_cache(
    async (): Promise<NameTableData[]> => {
      await connectDB();
      const docs = (await BookEntry.find({ book: bookId, kind: "nameTable" }).select("data").lean()) as { data?: unknown }[];
      return docs.flatMap((d) => {
        const r = validateEntryData("nameTable", d.data);
        return r.ok ? [r.value] : [];
      });
    },
    ["rules-name-tables", bookId],
    { tags: [`book:${bookId}`], revalidate: 3600 },
  )();

// ?species=dwarf&pronouns=he,they → { name }: «Nombre Apellido» según la especie (o Humano) y los pronombres
export async function GET(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("name_generator", session.id, 600, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const sp = req.nextUrl.searchParams;
  const species = (sp.get("species") ?? "").trim().toLowerCase().slice(0, 80);
  const pronouns = (sp.get("pronouns") ?? "").split(",")
    .filter((p): p is Pronoun => PRONOUNS.some((x) => x.id === p));

  // Las tablas de los libros oficiales del sistema, aunque no se ofrezcan como libros de reglas (la Guía de Xanathar
  // solo aporta las tablas de nombres); no dependen de los libros elegidos para el personaje
  await connectDB();
  const books = await Book.find({ owner: null, visibility: "public", systemId: SYSTEM }).select("_id").lean();
  const tables = (await Promise.all(books.map((b) => bookNameTables(String(b._id))))).flat();
  const table = nameTableFor(tables, species);
  const name = table ? generateName(table, [...new Set(pronouns)]) : "";
  if (!name) return NextResponse.json({ error: "No hay tablas de nombres disponibles." }, { status: 404 });
  return NextResponse.json({ name });
}
