import "server-only";
import { spellAreaInText } from "@/lib/rules/dnd2024/spells/spellArea";
import mongoose from "mongoose";
import { unstable_cache } from "next/cache";
import { connectDB } from "@/lib/models/mongodb";
import { Book } from "@/lib/models/Book";
import { BookEntry } from "@/lib/models/BookEntry";
import { Campaign } from "@/lib/models/Campaign";
import { escapeRegex } from "@/lib/utils/utils";
import { visibleBooksOf } from "@/lib/server/catalog/books";
import { isMasteryWeapon } from "@/lib/rules/dnd2024/levels/masteries";
import { CORE_BOOK_KEY, pickBooks } from "@/lib/rules/catalog/pickBooks";
import { normalizeName, validateEntryData } from "@/lib/rules/schemas";
import { spellSummary } from "@/lib/rules/dnd2024/spells/spellText";
import { inSpellList, spellRowOf, type SpellRow } from "@/lib/rules/catalog/spellRows";
import type { EntryKind, ItemData, Ref, SpellData } from "@/lib/rules/types";
import type { CatalogEntry, EntryOption, SpellOption } from "@/lib/rules/catalog/types";

export { pickBooks };
export type { CatalogEntry, EntryOption, SpellOption };

/** La campaña no existe o el usuario no es miembro (las rutas responden 404). */
export class NotFoundError extends Error {
  constructor(message = "Campaña no encontrada.") {
    super(message);
    this.name = "NotFoundError";
  }
}

const MAX_RESULTS = 2000;
const CACHE_SECONDS = 3600;
// Solo estos tipos devuelven `data` en el listado; el resto lo omite para aligerar la respuesta
// (las dotes y los rasgos opcionales, para filtrarlos por categoría en las elecciones de clase; los idiomas, por
// estándar o raro)
const KINDS_WITH_DATA: readonly EntryKind[] = ["species", "lineage", "class", "background", "feat", "optionalFeature", "language"];

/* Libros que el usuario puede usar para crear un personaje:
   visibles (oficiales públicos del sistema + propios) ∩ campaña ∩ elegidos. */
export async function usableBooks(opts: {
  userId: string;
  systemId: string;
  campaignId?: string;
  chosenBooks?: string[];
}): Promise<string[]> {
  const options = await visibleBooksOf(opts.userId, opts.systemId);
  const visible = options.map((b) => b.id);
  const core = options.filter((b) => b.key === CORE_BOOK_KEY).map((b) => b.id);

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

  return pickBooks({ visible, campaign, chosen: opts.chosenBooks ?? [], core });
}

type EntryDoc = {
  book: unknown;
  key: string;
  name: string;
  nameEs?: string;
  nameLower: string;
  srd52?: boolean;
  page?: number | null;
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

const NOT_SUPERSEDED = { superseded: { $ne: true } };
const validIds = (books: string[]) => [...new Set(books)].filter((id) => mongoose.isValidObjectId(id)).sort();

async function bookNames(ids: string[]): Promise<Map<string, string>> {
  const docs = (await Book.find({ _id: { $in: ids } }).select("name").lean()) as unknown as { _id: unknown; name: string }[];
  return new Map(docs.map((b) => [String(b._id), b.name]));
}

/* Una lista del catálogo para un conjunto de libros: una sola consulta aunque haya decenas de libros. La clave de caché lleva
   los libros y las etiquetas `book:<id>` permiten invalidar la lista al editar cualquiera de ellos. */
function cachedList<T>(name: string, args: string[], ids: string[], load: (names: Map<string, string>) => Promise<T[]>): Promise<T[]> {
  if (!ids.length) return Promise.resolve([]);
  return unstable_cache(
    async () => {
      await connectDB();
      return load(await bookNames(ids));
    },
    [name, ids.join(","), ...args],
    { tags: ids.map((id) => `book:${id}`), revalidate: CACHE_SECONDS },
  )();
}

/* Entradas de un tipo en los libros dados, ordenadas por nombre (sin tildes); `q` busca por prefijo. Se omiten las de libros que
   ya no existen y aquellas cuyo `data` no es válido para su tipo (p. ej. las de usuario aún sin rellenar), para que el asistente
   no ofrezca opciones con las que no puede trabajar. */
export async function listEntries(opts: {
  books: string[];
  kind: EntryKind;
  parent?: string;
  q?: string;
}): Promise<EntryOption[]> {
  const { kind } = opts;
  const parent = opts.parent ?? "";
  const q = normalizeName((opts.q ?? "").trim());
  const ids = validIds(opts.books);
  return cachedList("rules-entries-v13", [kind, parent, q], ids, async (names) => {
    const withData = KINDS_WITH_DATA.includes(kind);
    const filter: Record<string, unknown> = { book: { $in: ids }, kind, ...NOT_SUPERSEDED };
    if (parent) filter["parent.key"] = parent;
    if (q) filter.nameLower = { $regex: "^" + escapeRegex(q) };
    const docs = (await BookEntry.find(filter)
      .select("-description -descriptionEs -foundry")
      .sort({ nameLower: 1 })
      .limit(MAX_RESULTS)
      .lean()) as unknown as EntryDoc[];
    return docs
      .filter((d) => names.has(String(d.book)) && validateEntryData(kind, d.data).ok)
      .map((d) => toOption(d, names.get(String(d.book))!, withData));
  });
}

// Objetos (con `data`) que cumplen `match` y son válidos, de los libros dados y ordenados por nombre
async function listItems(cacheName: string, books: string[], match: Record<string, unknown>, keep: (data: ItemData) => boolean) {
  const ids = validIds(books);
  return cachedList(cacheName, [], ids, async (names) => {
    const docs = (await BookEntry.find({ book: { $in: ids }, kind: "item", ...NOT_SUPERSEDED, ...match })
      .select("-description -descriptionEs -foundry")
      .sort({ nameLower: 1 })
      .lean()) as unknown as EntryDoc[];
    return docs
      .filter((d) => names.has(String(d.book)) && validateEntryData("item", d.data).ok && keep(d.data as ItemData))
      .map((d) => toOption(d, names.get(String(d.book))!, true));
  });
}

/** Armas con propiedad de maestría de los libros dados, ordenadas por nombre. */
export function listMasteryWeapons(books: string[]): Promise<EntryOption[]> {
  return listItems("rules-mastery-weapons-v4", books, { "data.weapon.mastery": { $exists: true } }, isMasteryWeapon);
}

/** Objetos no mágicos que pueden ser la elección de un paquete de equipo (juegos, instrumentos, herramientas de artesano y armas
 *  sencillas o marciales), con `data` para filtrarlos con `choiceMatches`; de los libros dados, ordenados por nombre. */
export function listChoiceItems(books: string[]): Promise<EntryOption[]> {
  return listItems("rules-choice-items-v4", books, {
    "data.rarity": { $exists: false },
    $or: [{ "data.type": { $in: ["GS", "INS", "AT"] } }, { "data.weapon.category": { $in: ["simple", "martial"] } }],
  }, () => true);
}

/** Conjuros de los libros dados con datos y resumen, para la pestaña Conjuros (sin el límite del listado); ordenados por nombre. */
export async function listSpells(books: string[]): Promise<SpellOption[]> {
  const ids = validIds(books);
  return cachedList("rules-spells-v6", [], ids, async (names) => {
    const docs = (await BookEntry.find({ book: { $in: ids }, kind: "spell", ...NOT_SUPERSEDED })
      .select("-foundry")
      .sort({ nameLower: 1 })
      .lean()) as unknown as FullEntryDoc[];
    return docs
      .filter((d) => names.has(String(d.book)) && validateEntryData("spell", d.data).ok)
      .map((d) => {
        // La mejora va también al final de la descripción, que se pide al abrir la ficha del conjuro
        const data = { ...(d.data as SpellData) };
        delete data.higherLevels;
        const area = spellAreaInText(d.description || "");
        if (area) data.area = area;
        const summary = spellSummary(d.descriptionEs || d.description || "");
        return { ...toOption(d, names.get(String(d.book))!, false), data, summary };
      });
  });
}

/** Acciones básicas de combate (entradas `action`) de los libros dados, completas y ordenadas por nombre. */
export async function listActions(books: string[]): Promise<CatalogEntry[]> {
  const ids = validIds(books);
  return cachedList("rules-actions-v7", [], ids, async (names) => {
    const docs = (await BookEntry.find({ book: { $in: ids }, kind: "action", ...NOT_SUPERSEDED })
      .select("-foundry")
      .sort({ nameLower: 1 })
      .lean()) as unknown as FullEntryDoc[];
    return docs
      .filter((d) => names.has(String(d.book)) && validateEntryData("action", d.data).ok)
      .map((d) => toEntry(d, names.get(String(d.book))!));
  });
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
  page: d.page ?? null,
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
