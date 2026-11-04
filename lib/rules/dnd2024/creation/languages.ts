// Idiomas del personaje: los que da la clase (fijos) y los que elige (huecos). Puro: la consulta al catálogo la
// inyecta quien llama.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { LanguageData, Ref } from "@/lib/rules/types";

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

/** Los idiomas fijos como referencias; el libro es el de la clase (los idiomas de la hoja son de los mismos libros). */
export const fixedLanguageRefs = (classLevels: ClassLevels, book: string): Ref[] =>
  fixedLanguages(classLevels).map((key) => ({ book, key }));

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
 * Comprueba los idiomas elegidos (`picks`, en el orden de los huecos): el número exacto por hueco, sin repetir entre
 * sí ni con los fijos, y estándar donde se pide. Devuelve el mensaje de error o `null`.
 */
export function checkLanguages(
  picks: Ref[], slots: LanguageSlot[], fixed: string[], lookup: (ref: Ref) => CatalogEntry | null,
): string | null {
  const total = slots.reduce((n, s) => n + s.count, 0);
  if (picks.length < total) return "Faltan idiomas por elegir.";
  if (picks.length > total) return "Has elegido demasiados idiomas.";
  const known = new Set(fixed);
  let i = 0;
  for (const slot of slots) {
    for (let n = 0; n < slot.count; n++, i++) {
      const pick = picks[i];
      const entry = lookup(pick);
      if (!entry) return "Idioma no disponible.";
      if (known.has(pick.key)) return "Ya conoces ese idioma.";
      if (slot.standardOnly && (entry.data as LanguageData | null)?.type !== "standard")
        return `Elige idiomas estándar para tus ${slot.label.toLowerCase()}.`;
      known.add(pick.key);
    }
  }
  return null;
}
