// Añade a los objetos oficiales ya importados si requieren sintonización y sus efectos mecánicos (`data.attunement` y
// `data.bonuses`), leídos de 5etools, sin reimportar nada más. Solo toca esos dos campos.
// Uso: npm run apply:item-magic -- [--data <carpeta data de 5etools>]        (simulación: informa y no escribe)
//      npm run apply:item-magic -- [--data <carpeta>] --apply
import { readFileSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

// tsx no carga .env.local por sí solo
try {
  process.loadEnvFile(".env.local");
} catch {}

import { connectDB } from "../lib/models/mongodb";
import { Book } from "../lib/models/Book";
import { BookEntry } from "../lib/models/BookEntry";
import { itemMagic } from "../lib/rules/import/normalize";

type Raw = Record<string, unknown> & { name: string; source: string; _copy?: { name: string; source: string } };
type Row = { _id: mongoose.Types.ObjectId; key: string; book: mongoose.Types.ObjectId; data?: Record<string, unknown> };

const keyOf = (name: string, source: string) => `item:${name.toLowerCase()}|${source.toLowerCase()}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function main() {
  const apply = process.argv.includes("--apply");
  const flag = process.argv.indexOf("--data");
  const dir = flag >= 0 ? process.argv[flag + 1] : path.resolve("../5etools/5etools-src/data");
  // (`itemGroup`: las entradas genéricas, como «Piedra Ioun» o «Baraja de cartas»)
  const file = JSON.parse(readFileSync(path.join(dir, "items.json"), "utf8")) as { item: Raw[]; itemGroup?: Raw[] };
  const raw = [...file.item, ...(file.itemGroup ?? [])];

  // Un objeto `_copy` hereda los campos del original, salvo los que redefine
  const byKey = new Map(raw.map((r) => [keyOf(r.name, r.source), r]));
  const resolved = (r: Raw): Raw => {
    const base = r._copy ? byKey.get(keyOf(r._copy.name, r._copy.source)) : undefined;
    return base ? { ...resolved(base), ...r } : r;
  };

  await connectDB();
  const books = await Book.find({ owner: null }).select("key").lean<{ _id: mongoose.Types.ObjectId; key: string }[]>();
  const names = new Map(books.map((b) => [String(b._id), b.key]));
  const rows = await BookEntry.find({ book: { $in: books.map((b) => b._id) }, kind: "item" }).select("key book data").lean<Row[]>();

  const changes = rows.flatMap((row) => {
    const source = byKey.get(row.key);
    if (!source) return [];
    const magic = itemMagic(resolved(source));
    return same(row.data?.attunement, magic.attunement) && same(row.data?.bonuses, magic.bonuses) ? [] : [{ row, magic }];
  });
  const unmatched = rows.filter((r) => r.data?.rarity && !byKey.has(r.key));

  const perBook = new Map<string, number>();
  for (const { row } of changes) perBook.set(names.get(String(row.book)) ?? "?", (perBook.get(names.get(String(row.book)) ?? "?") ?? 0) + 1);
  console.log(`Objetos oficiales: ${rows.length} · por actualizar: ${changes.length}`);
  console.log(`Con sintonización: ${changes.filter((c) => c.magic.attunement).length} · con efectos: ${changes.filter((c) => c.magic.bonuses).length}`);
  console.log("Por libro:", Object.fromEntries([...perBook].sort((a, b) => b[1] - a[1])));
  console.log(`Mágicos sin dato en 5etools (se omiten): ${unmatched.length}`, unmatched.slice(0, 15).map((r) => r.key));
  console.log("Ejemplos:", changes.filter((c) => c.magic.bonuses).slice(0, 6).map((c) => `${c.row.key} ${JSON.stringify(c.magic)}`));

  if (!apply) {
    console.log("\nSimulación: no se ha escrito nada. Usa --apply para guardar.");
  } else if (changes.length) {
    const result = await BookEntry.bulkWrite(changes.map(({ row, magic }) => {
      const set = Object.fromEntries(Object.entries({ "data.attunement": magic.attunement, "data.bonuses": magic.bonuses }).filter(([, v]) => v !== undefined));
      const unset = Object.fromEntries(Object.entries({ "data.attunement": magic.attunement, "data.bonuses": magic.bonuses }).filter(([, v]) => v === undefined).map(([k]) => [k, ""]));
      return { updateOne: { filter: { _id: row._id }, update: { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) } } };
    }));
    console.log(`\nActualizados: ${result.modifiedCount}`);
  }
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
