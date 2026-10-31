import "server-only";
import { unstable_cache } from "next/cache";
import { connectDB } from "@/lib/models/mongodb";
import { Book } from "@/lib/models/Book";
import { BookEntry } from "@/lib/models/BookEntry";
import { validateEntryData } from "@/lib/rules/schemas";
import type { NameTableData } from "@/lib/rules/types";

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

/* Las tablas de los libros oficiales del sistema, aunque no se ofrezcan como libros de reglas (la Guía de Xanathar
   solo aporta las tablas de nombres); no dependen de los libros elegidos para el personaje. */
export async function officialNameTables(systemId: string): Promise<NameTableData[]> {
  await connectDB();
  const books = await Book.find({ owner: null, visibility: "public", systemId }).select("_id").lean();
  return (await Promise.all(books.map((b) => bookNameTables(String(b._id))))).flat();
}
