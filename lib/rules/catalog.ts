import mongoose from "mongoose";
import { unstable_cache } from "next/cache";
import { connectDB } from "@/lib/models/mongodb";
import { Book } from "@/lib/models/Book";
import { BookEntry } from "@/lib/models/BookEntry";
import { Campaign } from "@/lib/models/Campaign";
import { escapeRegex } from "@/lib/utils/utils";
import { visibleBooksOf } from "@/lib/rules/books";
import { isMasteryWeapon } from "@/lib/rules/dnd2024/masteries";
import { pickBooks } from "@/lib/rules/pickBooks";
import { normalizeName, validateEntryData } from "@/lib/rules/schemas";
import { spellSummary } from "@/lib/rules/dnd2024/spellText";
import { inSpellList, spellRowOf, type SpellRow } from "@/lib/rules/spellRows";
import type { EntryKind, ItemData, Ref, SpellData } from "@/lib/rules/types";

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
// (las dotes y los rasgos opcionales, para filtrarlos por categoría en las elecciones de clase)
const KINDS_WITH_DATA: readonly EntryKind[] = ["species", "lineage", "class", "background", "feat", "optionalFeature"];

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
   invalidar un libro entero al editarlo. Se omiten las entradas cuyo `data` no es válido para su tipo (p. ej. las
   de usuario aún sin rellenar), para que el asistente no ofrezca opciones con las que no puede trabajar. */
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
        .select("-description -descriptionEs -foundry")
        .sort({ nameLower: 1 })
        .limit(MAX_RESULTS)
        .lean()) as unknown as EntryDoc[];
      return {
        entries: docs
          .filter((d) => validateEntryData(kind, d.data).ok)
          .map((d) => ({ sort: d.nameLower, option: toOption(d, book.name, withData) })),
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

/* Armas con propiedad de maestría de un libro (con `data`), para elegir maestrías. Misma caché que el listado. */
function listBookMasteryWeapons(bookId: string) {
  return unstable_cache(
    async (): Promise<Cached> => {
      await connectDB();
      const book = await Book.findById(bookId).select("name").lean();
      if (!book) return { entries: [] };
      const docs = (await BookEntry.find({ book: bookId, kind: "item", "data.weapon.mastery": { $exists: true } })
        .select("-description -descriptionEs -foundry")
        .sort({ nameLower: 1 })
        .lean()) as unknown as EntryDoc[];
      return {
        entries: docs
          .filter((d) => validateEntryData("item", d.data).ok && isMasteryWeapon(d.data as ItemData))
          .map((d) => ({ sort: d.nameLower, option: toOption(d, book.name, true) })),
      };
    },
    ["rules-mastery-weapons", bookId],
    { tags: [`book:${bookId}`], revalidate: CACHE_SECONDS },
  )();
}

/** Armas con propiedad de maestría de los libros dados, ordenadas por nombre. */
export async function listMasteryWeapons(books: string[]): Promise<EntryOption[]> {
  const ids = [...new Set(books)].filter((id) => mongoose.isValidObjectId(id)).sort();
  const lists = await Promise.all(ids.map(listBookMasteryWeapons));
  return lists
    .flatMap((l) => l.entries)
    .sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0))
    .map((e) => e.option);
}

/** Conjuro del listado de la ficha: con sus datos (sin la mejora) y la línea de resumen, sin la descripción. */
export type SpellOption = EntryOption & { data: SpellData; summary: string };

type CachedSpells = { entries: { sort: string; option: SpellOption }[] };

/* Todos los conjuros de un libro con datos y resumen, para la pestaña Conjuros (sin el límite del listado, que se
   queda corto para un libro con 391). Misma caché que el listado. */
function listBookSpells(bookId: string) {
  return unstable_cache(
    async (): Promise<CachedSpells> => {
      await connectDB();
      const book = await Book.findById(bookId).select("name").lean();
      if (!book) return { entries: [] };
      const docs = (await BookEntry.find({ book: bookId, kind: "spell" })
        .select("-foundry")
        .sort({ nameLower: 1 })
        .lean()) as unknown as FullEntryDoc[];
      return {
        entries: docs
          .filter((d) => validateEntryData("spell", d.data).ok)
          .map((d) => {
            // La mejora va también al final de la descripción, que se pide al abrir la ficha del conjuro
            const data = { ...(d.data as SpellData) };
            delete data.higherLevels;
            const summary = spellSummary(d.descriptionEs || d.description || "");
            return { sort: d.nameLower, option: { ...toOption(d, book.name, false), data, summary } };
          }),
      };
    },
    ["rules-spells", bookId],
    { tags: [`book:${bookId}`], revalidate: CACHE_SECONDS },
  )();
}

/** Conjuros de los libros dados, ordenados por nombre. */
export async function listSpells(books: string[]): Promise<SpellOption[]> {
  const ids = [...new Set(books)].filter((id) => mongoose.isValidObjectId(id)).sort();
  const lists = await Promise.all(ids.map(listBookSpells));
  return lists
    .flatMap((l) => l.entries)
    .sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0))
    .map((e) => e.option);
}

/** Filas ligeras de una lista de clase (`ALL_LISTS`: de todas) en los libros dados, ordenadas por nombre. */
export async function listSpellRows(books: string[], list: string): Promise<SpellRow[]> {
  return (await listSpells(books)).filter((s) => inSpellList(s.data.classes, list)).map(spellRowOf);
}

type FullEntryDoc = EntryDoc & {
  description?: string;
  descriptionEs?: string;
  identifier?: string;
  parent?: { book: unknown; key: string };
  foundry?: unknown;
};

const toEntry = (d: FullEntryDoc, bookName: string): CatalogEntry => ({
  ...toOption(d, bookName, true),
  description: d.description ?? "",
  descriptionEs: d.descriptionEs ?? "",
  identifier: d.identifier ?? "",
  parent: d.parent ? { book: String(d.parent.book), key: d.parent.key } : null,
  foundry: d.foundry ?? null,
});

const validRef = (ref: Ref) => mongoose.isValidObjectId(ref.book) && typeof ref.key === "string";

// Entrada completa por referencia, sin comprobar visibilidad (quien llama debe haberla comprobado)
export async function getEntry(ref: Ref): Promise<CatalogEntry | null> {
  if (!validRef(ref)) return null;
  await connectDB();
  const doc = await BookEntry.findOne({ book: ref.book, key: ref.key }).lean();
  if (!doc) return null;
  const book = await Book.findById(ref.book).select("name").lean();
  return toEntry(doc as unknown as FullEntryDoc, book?.name ?? "");
}

const BATCH_SIZE = 200;

/** Como getEntry para varias referencias: una consulta por lote de 200. Las que no existen no aparecen. */
export async function getEntries(refs: Ref[]): Promise<CatalogEntry[]> {
  const valid = refs.filter(validRef);
  if (valid.length === 0) return [];
  await connectDB();
  const batches: Ref[][] = [];
  for (let i = 0; i < valid.length; i += BATCH_SIZE) batches.push(valid.slice(i, i + BATCH_SIZE));
  const docs = (await Promise.all(batches.map((b) =>
    BookEntry.find({ $or: b.map((r) => ({ book: r.book, key: r.key })) }).lean(),
  ))).flat() as unknown as FullEntryDoc[];
  const bookIds = [...new Set(docs.map((d) => String(d.book)))];
  const books = await Book.find({ _id: { $in: bookIds } }).select("name").lean();
  const bookName = new Map(books.map((b) => [String(b._id), b.name as string]));
  return docs.map((d) => toEntry(d, bookName.get(String(d.book)) ?? ""));
}

// Como getEntry, pero solo si el libro de la referencia está entre los permitidos
export async function resolveRef(ref: Ref, books: string[]): Promise<CatalogEntry | null> {
  if (!books.includes(ref.book)) return null;
  return getEntry(ref);
}
