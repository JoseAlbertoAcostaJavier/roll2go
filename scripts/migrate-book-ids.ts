// Migración única: sustituye los ids antiguos de lib/books.ts ("dnd-2024-phb", ...) por el _id
// del Book oficial correspondiente en Campaign.allowedBooks, Character.books y User.ownedBooks.
// Los ids que no tienen libro oficial se descartan. Es idempotente: los ObjectId válidos se dejan.
// Uso: npm run migrate:books
import mongoose from "mongoose";

// tsx no carga .env.local por sí solo
try {
  process.loadEnvFile(".env.local");
} catch {}

import { convertBookIds } from "../lib/rules/migrateBookIds";
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

  if (!idByKey.has("XPHB")) {
    console.error(
      'No existe el libro oficial "XPHB". Ejecuta primero el importador (npm run import:5etools) y vuelve a lanzar la migración.',
    );
    process.exit(1);
  }

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
      const { ids: after, dropped } = convertBookIds(before, idByKey);
      for (const legacy of dropped)
        console.warn(`AVISO ${label}: documento ${doc._id}, id antiguo "${legacy}" descartado (no hay libro oficial)`);
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
