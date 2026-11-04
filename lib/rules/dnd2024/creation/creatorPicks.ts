// Lo que el creador guarda de las elecciones de objetos e idiomas, y cómo se limpia al cambiar de opción o de clase.
// Puro: el creador (navegador) y las pruebas lo comparten.
import type { Equipment, Pack, Ref } from "@/lib/rules/types";
import type { LanguageSlot } from "./languages";

/** Los `Pack` con `choose` de la opción de equipo `letter`, con su índice en texto (la clave del pick). */
export function choosePacks(equipment: Equipment | undefined, letter: string): { index: string; pack: Pack }[] {
  return (equipment?.[letter] ?? []).flatMap((pack, i) => (pack.choose ? [{ index: String(i), pack }] : []));
}

/** Los picks que siguen valiendo para esa opción: solo los de un `Pack` con `choose`. */
export function prunePicks(
  picks: Record<string, Ref>, equipment: Equipment | undefined, letter: string,
): Record<string, Ref> {
  const valid = new Set(choosePacks(equipment, letter).map((c) => c.index));
  return Object.fromEntries(Object.entries(picks).filter(([i]) => valid.has(i)));
}

/** Cuántos idiomas se eligen en total. */
export const languageTotal = (slots: LanguageSlot[]) => slots.reduce((n, s) => n + s.count, 0);

/**
 * Los idiomas elegidos que siguen valiendo con estos huecos (uno por posición; `null` = sin elegir): se quitan los que
 * sobran, los que ya se conocen, los repetidos y los que no son estándar donde se pide. `typeOf` da el tipo del idioma
 * (`null` = desconocido).
 */
export function pruneLanguages(
  choices: (Ref | null)[], slots: LanguageSlot[], fixed: string[], typeOf: (ref: Ref) => string | null,
): (Ref | null)[] {
  const known = new Set(fixed);
  const out: (Ref | null)[] = [];
  let i = 0;
  for (const slot of slots) {
    for (let n = 0; n < slot.count; n++, i++) {
      const pick = choices[i] ?? null;
      const ok = pick && !known.has(pick.key) && typeOf(pick) !== null && (!slot.standardOnly || typeOf(pick) === "standard");
      if (ok) known.add(pick.key);
      out.push(ok ? pick : null);
    }
  }
  return out;
}
