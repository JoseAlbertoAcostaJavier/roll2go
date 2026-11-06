// Idiomas del personaje: los que da la clase (fijos) y los que elige (huecos). Puro: la consulta al catálogo la
// inyecta quien llama.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { LanguageData, Ref } from "@/lib/rules/types";
import { normalizeName } from "@/lib/rules/schemas";
import { bareName } from "../sheet/equipmentRefs";
import type { Dnd2024SheetV2 } from "../sheet/sheet";

const COMMON = "language:common|xphb";
const THIEVES_CANT = "language:thieves' cant|xphb";
const DRUIDIC = "language:druidic|xphb";

/** Niveles por clase, con el nombre desnudo de la clase como clave ("rogue", "druid"…). */
export type ClassLevels = Record<string, number>;

/** Claves (sin libro) de los idiomas que se conocen sin elegir. */
export function fixedLanguages(classLevels: ClassLevels): string[] {
  return [
    COMMON,
    ...((classLevels.rogue ?? 0) >= 1 ? [THIEVES_CANT] : []),
    ...((classLevels.druid ?? 0) >= 1 ? [DRUIDIC] : []),
  ];
}

/** Los idiomas fijos como referencias, una por cada libro (el idioma está en el libro que lo contenga). */
export const fixedLanguageRefs = (classLevels: ClassLevels, books: string[]): Ref[] =>
  fixedLanguages(classLevels).flatMap((key) => books.map((book) => ({ book, key })));

/** `source` de la elección de idioma del Pícaro (Jerga de ladrones) al entrar en la clase por multiclase. */
export const ROGUE_LANGUAGES_SOURCE = "languages:rogue";

/** `source` de la elección de idiomas del Explorador (Explorador hábil) al subir a Explorador 2. */
export const RANGER_LANGUAGES_SOURCE = "languages:ranger";

/** Idiomas elegidos por la hoja: los de la creación y los que dieron los niveles (Explorador hábil). */
export const chosenLanguageRefs = (sheet: { languageChoices?: Ref[]; levels?: Dnd2024SheetV2["levels"] }): Ref[] => [
  ...(sheet.languageChoices ?? []),
  ...(sheet.levels ?? []).flatMap((l) => l.choices.flatMap((c) => (c.type === "languages" ? c.value : []))),
];

/**
 * Claves de los idiomas que ya conoce la hoja al subir un nivel de `classRef`: los fijos de sus clases (con el nivel
 * nuevo de esa clase) y los elegidos antes.
 */
export const knownLanguagesAt = (
  sheet: Pick<Dnd2024SheetV2, "levels" | "languageChoices">, classLevels: ClassLevels, classRef: Ref, newClassLevel: number,
): string[] => [
  ...fixedLanguages({ ...classLevels, [bareName(classRef.key)]: newClassLevel }),
  ...chosenLanguageRefs(sheet).map((r) => r.key),
];

/** Nombre con que se compara un idioma entre libros: el inglés sin tildes ni mayúsculas («language:elvish|xphb» → «elvish»). */
export const languageName = (key: string) => normalizeName(bareName(key));

/** Nombres en español de los idiomas fijos, para cuando el catálogo no los tiene. */
export const FIXED_LANGUAGE_NAMES_ES: Record<string, string> = { common: "Común", "thieves' cant": "Jerga de ladrones", druidic: "Druídico" };

/** Un idioma del catálogo de los libros del personaje: su nombre (inglés, normalizado) y su tipo (estándar o raro). */
export type LanguageInfo = { name: string; type: string | null };
export const languagePool = (list: { name: string; data: unknown }[]): LanguageInfo[] =>
  list.map((l) => ({ name: normalizeName(l.name), type: (l.data as LanguageData | null)?.type ?? null }));

export type LanguageSlot = { source: "origin" | "rogue" | "ranger"; label: string; count: number; standardOnly: boolean };

/** Idiomas a elegir, en este orden: origen, Pícaro y Explorador. */
export function languageSlots(classLevels: ClassLevels): LanguageSlot[] {
  return [
    { source: "origin", label: "Idiomas de origen", count: 2, standardOnly: true },
    ...((classLevels.rogue ?? 0) >= 1
      ? [{ source: "rogue" as const, label: "Jerga de ladrones", count: 1, standardOnly: false }] : []),
    ...((classLevels.ranger ?? 0) >= 2
      ? [{ source: "ranger" as const, label: "Explorador hábil", count: 2, standardOnly: false }] : []),
  ];
}

/**
 * Recorta cuántos idiomas se piden en cada hueco a los que se pueden elegir de verdad en `pool` (estándar donde se pide,
 * sin los ya conocidos —`known`: claves— ni los que se llevan los huecos anteriores). Sin idiomas en el catálogo no se
 * pide ninguno.
 */
export function capSlots(slots: LanguageSlot[], pool: LanguageInfo[], known: string[]): LanguageSlot[] {
  const names = new Set(known.map(languageName));
  let used = 0;
  return slots.map((s) => {
    const eligible = new Set(pool.filter((l) => !names.has(l.name) && (!s.standardOnly || l.type === "standard")).map((l) => l.name)).size;
    const count = Math.max(0, Math.min(s.count, eligible - used));
    used += count;
    return { ...s, count };
  });
}

/**
 * Comprueba los idiomas elegidos (`picks`, en el orden de los huecos): el número exacto por hueco, sin repetir entre
 * sí ni con los fijos, y estándar donde se pide. Devuelve el mensaje de error o `null`.
 */
export function checkLanguages(
  picks: Ref[], slots: LanguageSlot[], fixed: string[], lookup: (ref: Ref) => CatalogEntry | null,
): string | null {
  const total = slots.reduce((n, s) => n + s.count, 0);
  if (picks.length < total) return "Faltan idiomas por elegir.";
  if (picks.length > total) return "Has elegido demasiados idiomas.";
  const known = new Set(fixed.map(languageName));
  let i = 0;
  for (const slot of slots) {
    for (let n = 0; n < slot.count; n++, i++) {
      const pick = picks[i];
      const entry = lookup(pick);
      if (!entry) return "Idioma no disponible.";
      const name = normalizeName(entry.name);
      if (known.has(name)) return "Ya conoces ese idioma.";
      if (slot.standardOnly && (entry.data as LanguageData | null)?.type !== "standard")
        return `Elige idiomas estándar para tus ${slot.label.toLowerCase()}.`;
      known.add(name);
    }
  }
  return null;
}
