import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/models/mongodb";
import { Book } from "@/lib/models/Book";
import { CORE_BOOK_KEY } from "@/lib/rules/catalog/pickBooks";
import type { BookOption } from "@/lib/rules/catalog/types";

export type { BookOption };

/* Ids antiguos del catálogo fijo de lib/books.ts -> sigla del Book oficial.
   Solo lo usa scripts/migrate-book-ids.ts. */
export const LEGACY_BOOK_KEYS: Record<string, string> = {
  "dnd-2024-phb": "XPHB",
  "dnd-2024-dmg": "XDMG",
  "dnd-2024-mm": "XMM",
  "dnd-5-phb": "PHB",
  "dnd-5-dmg": "DMG",
  "dnd-5-mm": "MM",
};

type BookDoc = {
  _id: unknown;
  key?: string;
  systemId: string;
  name: string;
  license?: { type?: BookOption["license"]; attribution?: string };
};

const toOption = (b: BookDoc): BookOption => ({
  id: String(b._id),
  key: b.key ?? "",
  systemId: b.systemId,
  name: b.name,
  license: b.license?.type ?? "own",
  attribution: b.license?.attribution ?? "",
});

// Solo los libros que se ofrecen como libros de reglas (no los de apoyo, como el de las tablas de nombres)
export const LISTED = { listed: { $ne: false } } as const;

/** Filtro de los libros que ve un usuario: oficiales públicos y listados, y los suyos (opcionalmente de un sistema). */
export function visibleBooksFilter(userId: string, systemId?: string): Record<string, unknown> {
  return {
    $or: [{ owner: null, visibility: "public", ...LISTED }, { owner: userId }],
    ...(systemId ? { systemId } : {}),
  };
}

// Libros oficiales (owner null), públicos y listados de un sistema, por nombre
export async function officialBooksOf(systemId: string): Promise<BookOption[]> {
  await connectDB();
  const docs = await Book.find({ owner: null, visibility: "public", systemId, ...LISTED })
    .sort({ name: 1 })
    .lean();
  return docs.map(toOption);
}

// Libros que el usuario puede ver: oficiales públicos + los suyos (opcionalmente de un sistema)
export async function visibleBooksOf(userId: string, systemId?: string): Promise<BookOption[]> {
  await connectDB();
  const docs = await Book.find(visibleBooksFilter(userId, systemId)).sort({ name: 1 }).lean();
  return docs.map(toOption);
}

/** Ids de los libros de reglas básicas (siempre disponibles). */
export async function coreBookIds(): Promise<string[]> {
  await connectDB();
  const docs = await Book.find({ owner: null, key: CORE_BOOK_KEY }).select("_id").lean();
  return docs.map((b: { _id: unknown }) => String(b._id));
}

// Ids (de los dados) que son de libros oficiales y públicos, de cualquier sistema
export async function officialBookIds(ids: string[]): Promise<string[]> {
  const valid = ids.filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return [];
  await connectDB();
  const docs = await Book.find({ _id: { $in: valid }, owner: null, visibility: "public" })
    .select("_id")
    .lean();
  return docs.map((d) => String(d._id));
}

// Libros por id; los ids que no son válidos o no existen se ignoran
export async function booksByIds(ids: string[]): Promise<BookOption[]> {
  const valid = ids.filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return [];
  await connectDB();
  const docs = await Book.find({ _id: { $in: valid } }).lean();
  return docs.map(toOption);
}
