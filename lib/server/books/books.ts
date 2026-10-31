import "server-only";
// Libros propios del usuario y sus entradas. Las rutas comprueban antes con loadBook que el libro existe y si quien
// pide puede editarlo; la entrada (nombre, tipo, texto) ya viene limpia.
import { connectDB } from "@/lib/models/mongodb";
import { Book } from "@/lib/models/Book";
import { BookEntry } from "@/lib/models/BookEntry";
import { MAX_BOOKS_PER_USER, MAX_ENTRIES_PER_BOOK } from "@/lib/server/books/bookAccess";
import { isValidId, newId } from "@/lib/server/ids";
import { fail, type Result } from "@/lib/server/result";
import { normalizeName } from "@/lib/rules/schemas";
import { escapeRegex } from "@/lib/utils/utils";
import type { EntryKind } from "@/lib/rules/types";

// Mis libros (de un sistema, si se indica), sin el texto completo
export async function listMyBooks(userId: string, systemId: string | null) {
  await connectDB();
  return Book.find({ owner: userId, ...(systemId ? { systemId } : {}) })
    .select("-description") // el listado no necesita el texto completo
    .sort({ updatedAt: -1 })
    .lean();
}

// Libro propio nuevo, privado y con licencia propia (lo oficial/SRD nunca se crea por aquí)
export async function createBook(
  userId: string,
  input: { name: string; systemId: string; description: string },
): Promise<Result<{ id: string }>> {
  await connectDB();
  if ((await Book.countDocuments({ owner: userId })) >= MAX_BOOKS_PER_USER)
    return fail(400, `Has alcanzado el máximo de ${MAX_BOOKS_PER_USER} libros.`);

  const book = await Book.create({
    owner: userId,
    systemId: input.systemId,
    name: input.name,
    description: input.description,
    language: "es",
    visibility: "private",
    license: { type: "own" },
  });
  return { ok: true, id: String(book._id) };
}

export async function updateBook(bookId: string, update: Record<string, unknown>) {
  await Book.updateOne({ _id: bookId }, { $set: update });
}

// Borra el libro y todas sus entradas
export async function deleteBook(bookId: string) {
  await BookEntry.deleteMany({ book: bookId });
  await Book.deleteOne({ _id: bookId });
}

// Entradas de un libro, sin el texto completo; `q`, prefijo del nombre
export async function listBookEntries(bookId: string, kind: EntryKind | null, q: string) {
  const filter: Record<string, unknown> = { book: bookId };
  const qNorm = normalizeName(q);
  if (kind) filter.kind = kind;
  if (qNorm) filter.nameLower = { $regex: "^" + escapeRegex(qNorm) };
  return BookEntry.find(filter)
    .select("-description") // el listado no necesita el texto completo
    .sort({ kind: 1, nameLower: 1 })
    .limit(500)
    .lean();
}

export async function createBookEntry(
  bookId: string,
  input: { kind: EntryKind; name: string; description: string },
): Promise<Result<{ id: string }>> {
  if ((await BookEntry.countDocuments({ book: bookId })) >= MAX_ENTRIES_PER_BOOK)
    return fail(400, `Un libro admite como máximo ${MAX_ENTRIES_PER_BOOK} entradas.`);

  const { kind, name } = input;
  const entry = await BookEntry.create({
    book: bookId,
    kind,
    name,
    // Clave única dentro del libro, con el tipo delante como las importadas: `spell:bola-de-fuego|<id>`
    key: `${kind}:${normalizeName(name).replace(/\s+/g, "-")}|${newId()}`,
    nameLower: normalizeName(name),
    description: input.description,
    data: {}, // fase 2: aquí irá la validación por tipo
  });
  return { ok: true, id: String(entry._id) };
}

// Una entrada completa del libro, o null si el id no es válido o no es de este libro
export async function getBookEntry(bookId: string, entryId: string) {
  if (!isValidId(entryId)) return null;
  return BookEntry.findOne({ _id: entryId, book: bookId }).lean();
}

// Cambia el nombre y/o el texto de una entrada. false si no es de este libro.
export async function updateBookEntry(bookId: string, entryId: string, update: { name?: string; description?: string }) {
  const set: Record<string, unknown> = {};
  if (update.name !== undefined) {
    set.name = update.name;
    set.nameLower = normalizeName(update.name);
  }
  if (update.description !== undefined) set.description = update.description;
  const res = await BookEntry.updateOne({ _id: entryId, book: bookId }, { $set: set });
  return res.matchedCount > 0;
}

export async function deleteBookEntry(bookId: string, entryId: string) {
  await BookEntry.deleteOne({ _id: entryId, book: bookId });
}
