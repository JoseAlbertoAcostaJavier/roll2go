import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Book } from "@/lib/Book";

export const MAX_BOOKS_PER_USER = 50;
export const MAX_ENTRIES_PER_BOOK = 3000;
export const MAX_BOOK_NAME = 120;
export const MAX_BOOK_DESCRIPTION = 20000;
export const MAX_ENTRY_DESCRIPTION = 50000;

// Devuelve el libro y si el usuario puede leerlo / editarlo. Lo decide siempre el servidor.
export async function loadBook(bookId: string, userId: string | null) {
  if (!mongoose.isValidObjectId(bookId)) return null;
  await connectDB();
  const book = await Book.findById(bookId).lean();
  if (!book) return null;
  const isOwner = !!userId && !!book.owner && String(book.owner) === userId;
  const canRead = book.visibility === "public" || isOwner;
  if (!canRead) return null; // 404 en lugar de 403: no se revela que existe
  return { book, canEdit: isOwner };
}
