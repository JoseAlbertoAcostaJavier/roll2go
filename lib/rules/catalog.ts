import mongoose from "mongoose";
import { unstable_cache } from "next/cache";
import { connectDB } from "@/lib/mongodb";
import { Book } from "@/lib/Book";
import { BookEntry } from "@/lib/BookEntry";
import { Campaign } from "@/lib/Campaign";
import { escapeRegex } from "@/lib/utils";
import { visibleBooksOf } from "@/lib/rules/books";
import { pickBooks } from "@/lib/rules/pickBooks";
import { normalizeName } from "@/lib/rules/schemas";
import type { EntryKind, Ref } from "@/lib/rules/types";

export { pickBooks };

/** La campaña no existe o el usuario no es miembro (las rutas responden 404). */
export class NotFoundError extends Error {
  constructor(message = "Campaña no encontrada.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export type EntryOption = {
  ref: Ref;
  name: string;
  nameEs: string | null;
  bookName: string;
  srd52: boolean;
  data: unknown;
};

export type CatalogEntry = EntryOption & {
  description: string;
  descriptionEs: string;
  identifier: string;
  parent: Ref | null;
  foundry: unknown;
};

const MAX_RESULTS = 200;
const CACHE_SECONDS = 3600;
// Solo estos tipos devuelven `data` en el listado; el resto lo omite para aligerar la respuesta
const KINDS_WITH_DATA: readonly EntryKind[] = ["species", "lineage", "class", "background"];

/* Libros que el usuario puede usar para crear un personaje:
   visibles (oficiales públicos del sistema + propios) ∩ campaña ∩ elegidos. */
export async function usableBooks(opts: {
  userId: string;
  systemId: string;
  campaignId?: string;
  chosenBooks?: string[];
}): Promise<string[]> {
  const visible = (await visibleBooksOf(opts.userId, opts.systemId)).map((b) => b.id);

  let campaign: { restrictBooks: boolean; allowedBooks: string[] } | null = null;
  if (opts.campaignId) {
    if (!mongoose.isValidObjectId(opts.campaignId)) throw new NotFoundError();
    await connectDB();
    const doc = await Campaign.findOne({ _id: opts.campaignId, members: opts.userId })
      .select("restrictBooks allowedBooks")
      .lean();
    if (!doc) throw new NotFoundError();
    campaign = { restrictBooks: !!doc.restrictBooks, allowedBooks: (doc.allowedBooks ?? []).map(String) };
  }

  return pickBooks({ visible, campaign, chosen: opts.chosenBooks ?? [] });
}

type EntryDoc = {
  book: unknown;
  key: string;
  name: string;
  nameEs?: string;
  nameLower: string;
  srd52?: boolean;
  data?: unknown;
};

const toOption = (d: EntryDoc, bookName: string, withData: boolean): EntryOption => ({
  ref: { book: String(d.book), key: d.key },
  name: d.name,
  nameEs: d.nameEs || null,
  bookName,
  srd52: !!d.srd52,
  data: withData ? (d.data ?? null) : null,
});

type Cached = { entries: { sort: string; option: EntryOption }[] };

/* Listado de un libro. La clave de caché incluye todos los argumentos y la etiqueta `book:<id>` permite
   invalidar un libro entero al editarlo. */
function listBookEntries(bookId: string, kind: EntryKind, parent: string, q: string) {
  return unstable_cache(
    async (): Promise<Cached> => {
      await connectDB();
      const book = await Book.findById(bookId).select("name").lean();
      if (!book) return { entries: [] };
      const withData = KINDS_WITH_DATA.includes(kind);
      const filter: Record<string, unknown> = { book: bookId, kind };
      if (parent) filter["parent.key"] = parent;
      if (q) filter.nameLower = { $regex: "^" + escapeRegex(q) };
      const docs = (await BookEntry.find(filter)
        .select(withData ? "-description -descriptionEs -foundry" : "-description -descriptionEs -foundry -data")
        .sort({ nameLower: 1 })
        .limit(MAX_RESULTS)
        .lean()) as unknown as EntryDoc[];
      return {
        entries: docs.map((d) => ({ sort: d.nameLower, option: toOption(d, book.name, withData) })),
      };
    },
    ["rules-entries", bookId, kind, parent, q],
    { tags: [`book:${bookId}`], revalidate: CACHE_SECONDS },
  )();
}

// Entradas de un tipo en los libros dados, ordenadas por nombre (sin tildes); `q` busca por prefijo
export async function listEntries(opts: {
  books: string[];
  kind: EntryKind;
  parent?: string;
  q?: string;
}): Promise<EntryOption[]> {
  const books = [...new Set(opts.books)].filter((id) => mongoose.isValidObjectId(id)).sort();
  const q = normalizeName((opts.q ?? "").trim());
  const lists = await Promise.all(books.map((id) => listBookEntries(id, opts.kind, opts.parent ?? "", q)));
  return lists
    .flatMap((l) => l.entries)
    .sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0))
    .slice(0, MAX_RESULTS)
    .map((e) => e.option);
}

// Entrada completa por referencia, sin comprobar visibilidad (quien llama debe haberla comprobado)
export async function getEntry(ref: Ref): Promise<CatalogEntry | null> {
  if (!mongoose.isValidObjectId(ref.book) || typeof ref.key !== "string") return null;
  await connectDB();
  const doc = await BookEntry.findOne({ book: ref.book, key: ref.key }).lean();
  if (!doc) return null;
  const book = await Book.findById(ref.book).select("name").lean();
  const d = doc as unknown as EntryDoc & {
    description?: string;
    descriptionEs?: string;
    identifier?: string;
    parent?: { book: unknown; key: string };
    foundry?: unknown;
  };
  return {
    ...toOption(d, book?.name ?? "", true),
    description: d.description ?? "",
    descriptionEs: d.descriptionEs ?? "",
    identifier: d.identifier ?? "",
    parent: d.parent ? { book: String(d.parent.book), key: d.parent.key } : null,
    foundry: d.foundry ?? null,
  };
}

// Como getEntry, pero solo si el libro de la referencia está entre los permitidos
export async function resolveRef(ref: Ref, books: string[]): Promise<CatalogEntry | null> {
  if (!books.includes(ref.book)) return null;
  return getEntry(ref);
}
