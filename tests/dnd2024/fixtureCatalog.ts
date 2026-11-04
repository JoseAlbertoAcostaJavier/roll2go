// Catálogo de prueba con los datos de 5etools de tests/fixtures, normalizados como en el importador.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { BOOK_PLACEHOLDER, normalizeAll, type RawFiles } from "@/lib/rules/import/normalize";

const fixture = (f: string) =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "../fixtures/5etools", f), "utf8"));

export const B = "libro-prueba";
export const ref = (key: string) => ({ book: B, key });

// Como el importador: sustituye el marcador de libro por el id del libro
const withBook = <T,>(v: T): T =>
  JSON.parse(JSON.stringify(v).replaceAll(JSON.stringify(BOOK_PLACEHOLDER), JSON.stringify(B)));

/** `classFiles`: archivos `class-*.json` de los fixtures (por defecto, solo el Bárbaro). */
export function buildCatalog(classFiles = ["class-barbarian.json"]): Map<string, CatalogEntry> {
  const files: RawFiles = {
    races: fixture("races.json"),
    backgrounds: fixture("backgrounds.json"),
    feats: fixture("feats.json"),
    items: fixture("items.json"),
    itemsBase: fixture("items-base.json"),
    spells: [fixture("spells.json")],
    spellSources: fixture("spell-sources.json"),
    classes: classFiles.map(fixture),
    optionalFeatures: fixture("optionalfeatures.json"),
  };
  return new Map(normalizeAll(files, "XPHB").entries.map((e) => {
    const c: CatalogEntry = {
      ref: { book: B, key: e.key }, name: e.name, nameEs: null, bookName: "Libro", srd52: e.srd52,
      data: withBook(e.data), description: e.description, descriptionEs: "", identifier: e.identifier,
      page: e.page, parent: e.parent ? { book: B, key: e.parent.key } : null, foundry: null,
    };
    return [`${B}:${c.ref.key}`, c] as const;
  }));
}
