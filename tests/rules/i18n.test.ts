import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import es from "@/lib/rules/i18n/es.json";
import { normalizeAll, type RawFiles } from "@/lib/rules/import/normalize";
import { ENTRY_KINDS } from "@/lib/rules/types";

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
const VOCABULARY = ["ability", "alignment", "school", "condition", "subclassTitle"];
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
      // El tipo puede llevar mayúsculas (`optionalFeature`); el resto de la clave va en minúsculas
      const rest = k.slice(kind.length);
      const formatOk = known.has(k) || (KEY_FORMAT.test(k) && rest === rest.toLowerCase());
      return !(ENTRY_KINDS as readonly string[]).includes(kind) || !formatOk;
    });
    expect(bad).toEqual([]);
  });

  test("las claves que producen los fixtures coinciden exactamente", () => {
    // Detecta cambios en cómo se construyen las claves (p. ej. sin prefijo o con otra fuente)
    const sample = entryKeys.filter((k) => known.has(k));
    expect(sample).toEqual(expect.arrayContaining(["species:elf|xphb", "lineage:drow|xphb", "class:barbarian|xphb"]));
  });

  test("rasgos de clase de nivel 1 a 5 del XPHB: los del catálogo normalizado tienen nombre y las claves nuevas tienen el formato del normalizador", () => {
    const features = normalizeAll(files, "XPHB").entries.filter((e) => e.kind === "classFeature" && e.key.includes("|xphb|"));
    const early = features.filter((e) => Number(e.key.split("|")[3]) <= 5);
    expect(early.length).toBeGreaterThan(0);
    expect(early.filter((e) => !dict[e.key]?.trim()).map((e) => e.key)).toEqual([]);
    // 12 clases de XPHB con rasgos de nivel 1 a 5, todos con la clave que construye el normalizador
    const own = Object.keys(dict).filter((k) => k.startsWith("classFeature:"));
    expect(own.length).toBe(116);
    expect(own.filter((k) => !/^classFeature:[^|]+\|[a-z]+\|xphb\|[1-5]$/.test(k))).toEqual([]);
    expect(dict["classFeature:rage|barbarian|xphb|1"]).toBe("Furia");
  });
});
