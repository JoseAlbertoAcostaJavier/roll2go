// Importa una fuente de 5etools (por defecto el Player's Handbook 2024, XPHB) como libro oficial en MongoDB.
// Es idempotente: reimportar actualiza lo existente y borra lo que ya no llega.
// Uso: npm run import:5etools -- --data <carpeta data de 5etools> [--source XPHB] [--srd-only] [--dry-run]
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

// tsx no carga .env.local por sí solo
try {
  process.loadEnvFile(".env.local");
} catch {}

import { connectDB } from "../lib/mongodb";
import { Book } from "../lib/Book";
import { BookEntry } from "../lib/BookEntry";
import { BOOK_PLACEHOLDER, normalizeAll, type RawFiles } from "../lib/rules/import/normalize";
import { planImport } from "../lib/rules/import/plan";
import { matchFoundry, type FoundryFiles } from "../lib/rules/import/foundry";
import { normalizeName } from "../lib/rules/schemas";
import es from "../lib/rules/i18n/es.json";

const SRD_ATTRIBUTION =
  'This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.';
const BOOK_NAMES: Record<string, string> = { XPHB: "Manual del Jugador 2024" };
const BATCH = 500;

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const o = { data: "", source: "XPHB", srdOnly: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--data") o.data = argv[++i] ?? "";
    else if (a === "--source") o.source = argv[++i] ?? "";
    else if (a === "--srd-only") o.srdOnly = true;
    else if (a === "--dry-run") o.dryRun = true;
    else fail(`Argumento desconocido: ${a}`);
  }
  if (!o.data) fail("Falta --data <carpeta data de 5etools>.");
  if (!o.source) fail("Falta el valor de --source.");
  if (!existsSync(o.data)) fail(`No existe la carpeta: ${o.data}`);
  return o;
}

/** Lee un JSON; si no existe devuelve `undefined`. */
function readJson<T>(file: string): T | undefined {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : undefined;
}

/** Todos los `<prefijo>*.json` de una carpeta (los `fluff-` y `foundry` no empiezan por el prefijo). */
function readAll<T>(dir: string, prefix: string): T[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as T);
}

function loadRaw(data: string): RawFiles {
  const j = <T>(f: string) => readJson<T>(path.join(data, f)) as T;
  return {
    races: j("races.json"),
    backgrounds: j("backgrounds.json"),
    feats: j("feats.json"),
    items: j("items.json"),
    itemsBase: j("items-base.json"),
    languages: j("languages.json"),
    skills: j("skills.json"),
    spells: readAll(path.join(data, "spells"), "spells-"),
    spellSources: j("spells/sources.json"),
    classes: readAll(path.join(data, "class"), "class-"),
  };
}

function loadFoundry(data: string): FoundryFiles {
  const j = <T>(f: string) => readJson<T>(path.join(data, f));
  return {
    feats: j("foundry-feats.json"),
    items: j("foundry-items.json"),
    races: j("foundry-races.json"),
    backgrounds: j("foundry-backgrounds.json"),
    classes: j("class/foundry.json"),
    spells: j("spells/foundry.json"),
  };
}

const count = (xs: string[]) => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = args.source.toUpperCase();
  const dict = es as Record<string, string>;

  const { entries, errors } = normalizeAll(loadRaw(args.data), source);
  const foundry = matchFoundry(entries, loadFoundry(args.data));

  await connectDB();
  const bookFilter = { owner: null, key: source };
  const existingBook = await Book.findOne(bookFilter).select("_id").lean();
  const existingKeys = existingBook
    ? ((await BookEntry.find({ book: existingBook._id }).select("key").lean()) as { key: string }[]).map((e) => e.key)
    : [];
  const { upserts, deletes } = planImport(existingKeys, entries, { srdOnly: args.srdOnly });
  const existing = new Set(existingKeys);
  const created = upserts.filter((e) => !existing.has(e.key)).length;
  const updated = upserts.length - created;

  if (!args.dryRun) {
    const book = await Book.findOneAndUpdate(
      bookFilter,
      {
        $set: {
          systemId: "dnd-2024",
          visibility: "public",
          license: args.srdOnly
            ? { type: "srd", attribution: SRD_ATTRIBUTION, sourceUrl: "https://www.dndbeyond.com/srd" }
            : { type: "official", attribution: "", sourceUrl: "" },
        },
        // El nombre solo se pone al crear el libro, para no pisar un nombre cambiado después
        $setOnInsert: { owner: null, key: source, language: "es", name: BOOK_NAMES[source] ?? source },
      },
      { upsert: true, returnDocument: "after" },
    );
    const bookId = String(book._id);
    // Las referencias llevan un libro provisional que se sustituye por el id real
    const withBook = (data: unknown) =>
      JSON.parse(JSON.stringify(data).replaceAll(JSON.stringify(BOOK_PLACEHOLDER), JSON.stringify(bookId)));

    for (let i = 0; i < upserts.length; i += BATCH) {
      const ops = upserts.slice(i, i + BATCH).map((e) => {
        const nameEs = dict[e.key] ?? "";
        const $set: Record<string, unknown> = {
          kind: e.kind,
          identifier: e.identifier,
          name: e.name,
          nameEs,
          nameLower: normalizeName(nameEs || e.name),
          description: e.description,
          srd52: e.srd52,
          data: withBook(e.data),
        };
        const $unset: Record<string, 1> = {};
        if (e.parent) $set.parent = { book: book._id, key: e.parent.key };
        else $unset.parent = 1;
        const f = foundry.get(e.key);
        if (f) $set.foundry = f;
        else $unset.foundry = 1;
        return {
          updateOne: {
            filter: { book: book._id, key: e.key },
            update: { $set, ...(Object.keys($unset).length ? { $unset } : {}) },
            upsert: true,
          },
        };
      });
      await BookEntry.bulkWrite(ops);
    }
    for (let i = 0; i < deletes.length; i += BATCH) {
      await BookEntry.deleteMany({ book: book._id, key: { $in: deletes.slice(i, i + BATCH) } });
    }
  }

  // ---------- informe ----------
  console.log(`\nImportación de ${source}${args.dryRun ? " (simulación, no se escribe nada)" : ""}${args.srdOnly ? " [solo SRD]" : ""}`);
  console.log("\nEntradas por tipo:");
  for (const [kind, n] of count(upserts.map((e) => e.kind))) console.log(`  ${kind}: ${n}`);
  console.log(`\nTotal: ${upserts.length} | creadas: ${created} | actualizadas: ${updated} | borradas: ${deletes.length}`);
  console.log(`Con datos de Foundry: ${upserts.filter((e) => foundry.has(e.key)).length}`);
  console.log(`Errores de validación: ${errors.length}`);
  for (const e of errors) console.log(`  ${e.key}: ${e.errors.join("; ")}`);

  const untranslated = upserts.filter((e) => !dict[e.key]);
  console.log(`\nSin traducción: ${untranslated.length} de ${upserts.length}`);
  for (const [kind] of count(untranslated.map((e) => e.kind))) {
    const keys = untranslated.filter((e) => e.kind === kind).map((e) => e.key);
    if (["spell", "item", "classFeature", "subclassFeature"].includes(kind)) console.log(`  ${kind}: ${keys.length}`);
    else console.log(`  ${kind} (${keys.length}): ${keys.join(", ")}`);
  }
  console.log("\nLa caché del catálogo se renueva en 1 hora o al reiniciar el servidor.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
