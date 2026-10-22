import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import es from "@/lib/rules/i18n/es.json";
import { normalizeAll, type RawFiles } from "@/lib/rules/import/normalize";
import { ENTRY_KINDS } from "@/lib/BookEntry";

const fixture = (f: string) =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "../fixtures/5etools", f), "utf8"));

const files: RawFiles = {
  races: fixture("races.json"),
  backgrounds: fixture("backgrounds.json"),
  feats: fixture("feats.json"),
  items: fixture("items.json"),
  itemsBase: fixture("items-base.json"),
  spells: [fixture("spells.json")],
  spellSources: fixture("spell-sources.json"),
  classes: [fixture("class-barbarian.json")],
};

// Vocabulario de la interfaz: no son entradas del catálogo y no llevan fuente
const VOCABULARY = ["ability", "alignment", "school", "condition"];
// Formato de clave de entrada: `tipo:nombre|fuente` (las subclases y rasgos llevan más tramos)
const KEY_FORMAT = /^[a-zA-Z]+:[^|]+(\|[^|]+)+$/;

describe("diccionario es.json", () => {
  const dict = es as Record<string, string>;
  const known = new Set(normalizeAll(files, "XPHB").entries.map((e) => e.key));
  const entryKeys = Object.keys(dict).filter((k) => !VOCABULARY.includes(k.split(":")[0]));

  test("ningún nombre vacío", () => {
    expect(Object.entries(dict).filter(([, v]) => !v.trim())).toEqual([]);
  });

  test("las claves de entradas tienen un tipo conocido y el formato del normalizador", () => {
    const bad = entryKeys.filter((k) => {
      const kind = k.split(":")[0];
      const formatOk = known.has(k) || (KEY_FORMAT.test(k) && k === k.toLowerCase());
      return !(ENTRY_KINDS as readonly string[]).includes(kind) || !formatOk;
    });
    expect(bad).toEqual([]);
  });

  test("las claves que producen los fixtures coinciden exactamente", () => {
    // Detecta cambios en cómo se construyen las claves (p. ej. sin prefijo o con otra fuente)
    const sample = entryKeys.filter((k) => known.has(k));
    expect(sample).toEqual(expect.arrayContaining(["species:elf|xphb", "lineage:drow|xphb", "class:barbarian|xphb"]));
  });
});
