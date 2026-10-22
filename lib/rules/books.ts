import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Book } from "@/lib/Book";

export type BookOption = {
  id: string;
  key: string;
  systemId: string;
  name: string;
  license: "own" | "srd" | "official";
  attribution: string;
};

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

// Libros oficiales (owner null) y públicos de un sistema, por nombre
export async function officialBooksOf(systemId: string): Promise<BookOption[]> {
  await connectDB();
  const docs = await Book.find({ owner: null, visibility: "public", systemId })
    .sort({ name: 1 })
    .lean();
  return docs.map(toOption);
}

// Libros que el usuario puede ver: oficiales públicos + los suyos (opcionalmente de un sistema)
export async function visibleBooksOf(userId: string, systemId?: string): Promise<BookOption[]> {
  await connectDB();
  const filter: Record<string, unknown> = {
    $or: [{ owner: null, visibility: "public" }, { owner: userId }],
  };
  if (systemId) filter.systemId = systemId;
  const docs = await Book.find(filter).sort({ name: 1 }).lean();
  return docs.map(toOption);
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
