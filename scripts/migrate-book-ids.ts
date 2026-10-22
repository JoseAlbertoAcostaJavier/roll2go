// Migración única: sustituye los ids antiguos de lib/books.ts ("dnd-2024-phb", ...) por el _id
// del Book oficial correspondiente en Campaign.allowedBooks, Character.books y User.ownedBooks.
// Los ids que no tienen libro oficial se descartan. Es idempotente: los ObjectId válidos se dejan.
// Uso: npm run migrate:books
import mongoose from "mongoose";

// tsx no carga .env.local por sí solo
try {
  process.loadEnvFile(".env.local");
} catch {}

import { LEGACY_BOOK_KEYS } from "../lib/rules/books";
import { connectDB } from "../lib/mongodb";
import { Book } from "../lib/Book";
import { Campaign } from "../lib/Campaign";
import { Character } from "../lib/Character";
import { User } from "../lib/User";

async function main() {
  await connectDB();

  // sigla -> _id del Book oficial
  const official = await Book.find({ owner: null, key: { $gt: "" } })
    .select("key")
    .lean();
  const idByKey = new Map(official.map((b) => [b.key as string, String(b._id)]));

  const convert = (ids: string[]): string[] => {
    const out = new Set<string>();
    for (const id of ids) {
      if (mongoose.isValidObjectId(id)) {
        out.add(id);
        continue;
      }
      const key = LEGACY_BOOK_KEYS[id];
      const newId = key ? idByKey.get(key) : undefined;
      if (newId) out.add(newId);
    }
    return [...out];
  };

  const targets = [
    { label: "Campaign.allowedBooks", model: Campaign, field: "allowedBooks" },
    { label: "Character.books", model: Character, field: "books" },
    { label: "User.ownedBooks", model: User, field: "ownedBooks" },
  ];

  for (const { label, model, field } of targets) {
    let changed = 0;
    const docs = await model.find({ [field]: { $exists: true, $ne: [] } }).select(field).lean();
    for (const doc of docs) {
      const before = ((doc as Record<string, unknown>)[field] as string[]) ?? [];
      const after = convert(before);
      const same = before.length === after.length && before.every((v, i) => v === after[i]);
      if (same) continue;
      await model.updateOne({ _id: doc._id }, { $set: { [field]: after } });
      changed++;
    }
    console.log(`${label}: ${changed} documentos modificados`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
