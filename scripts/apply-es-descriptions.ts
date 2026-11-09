// Copia a `descriptionEs` los textos oficiales en español del SRD 5.2.1 (lib/rules/i18n/es-descriptions.json)
// y su nombre oficial (lib/rules/i18n/es.json). Solo toca entradas del libro oficial marcadas como SRD.
// Uso: npm run apply:es-descriptions        (simulación: informa y no escribe)
//      npm run apply:es-descriptions -- --apply
import mongoose from "mongoose";

// tsx no carga .env.local por sí solo
try {
  process.loadEnvFile(".env.local");
} catch {}

import { connectDB } from "../lib/models/mongodb";
import { Book } from "../lib/models/Book";
import { BookEntry } from "../lib/models/BookEntry";
import descriptions from "../lib/rules/i18n/es-descriptions.json";
import names from "../lib/rules/i18n/es.json";
import { normalizeName } from "../lib/rules/schemas";

const SOURCES = ["XPHB", "XDMG"];

type Row = { _id: mongoose.Types.ObjectId; key: string; srd52: boolean; descriptionEs?: string; nameEs?: string };

async function main() {
  const apply = process.argv.includes("--apply");
  const texts = descriptions as Record<string, string>;
  await connectDB();

  const books = await Book.find({ owner: null, key: { $in: SOURCES } }).select("_id").lean<{ _id: mongoose.Types.ObjectId }[]>();
  if (books.length !== SOURCES.length) throw new Error(`Faltan libros oficiales: se esperaban ${SOURCES.join(", ")}.`);

  const rows = await BookEntry.find({ book: { $in: books.map((b) => b._id) }, key: { $in: Object.keys(texts) } })
    .select("key srd52 descriptionEs nameEs")
    .lean<Row[]>();
  const found = new Map(rows.map((r) => [r.key, r]));

  const missing = Object.keys(texts).filter((k) => !found.has(k));
  const notSrd = rows.filter((r) => !r.srd52).map((r) => r.key);
  const nameOf = (key: string) => (names as Record<string, string>)[key];
  const pending = rows.filter((r) => r.srd52 && (r.descriptionEs !== texts[r.key] || r.nameEs !== nameOf(r.key)));
  const replaced = pending.filter((r) => r.descriptionEs && r.descriptionEs !== texts[r.key]);

  console.log(`Textos: ${Object.keys(texts).length} · encontradas: ${rows.length} · por actualizar: ${pending.length}`);
  console.log(`Sin entrada en la base: ${missing.length}`, missing.slice(0, 20));
  console.log(`Encontradas pero no SRD (se omiten): ${notSrd.length}`, notSrd.slice(0, 20));
  console.log(`Con otro texto en español (se sustituirían): ${replaced.length}`, replaced.map((r) => r.key).slice(0, 20));

  if (!apply) {
    console.log("\nSimulación: no se ha escrito nada. Usa --apply para guardar.");
  } else if (pending.length) {
    const result = await BookEntry.bulkWrite(pending.map((r) => ({
      updateOne: { filter: { _id: r._id, srd52: true }, update: { $set: { descriptionEs: texts[r.key], nameEs: nameOf(r.key), nameLower: normalizeName(nameOf(r.key)) } } },
    })));
    console.log(`\nActualizadas: ${result.modifiedCount}`);
  }
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
