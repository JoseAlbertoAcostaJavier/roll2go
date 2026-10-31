// Elecciones de conjuros que pide un nivel de clase: la forma de las de los conjuros de la clase (`SpellsPending`) y
// de los que no cuentan para los límites (`BonusSpellsPending`), su fuente, los trucos de más de las opciones de rasgo
// y las listas de Secretos mágicos. Funciones puras.
import type { ClassData, Ref, SpellcastingMode } from "@/lib/rules/types";
import { MAGICAL_SECRETS } from "./featureChoices";

/**
 * Conjuros que da un rasgo fuera de los límites (`bonusSpells`): la clase en cuyo bloque quedan siempre preparados,
 * las listas de las que se eligen, si solo trucos, si del libro de la clase, el nivel exacto (`level`) o el máximo
 * (`maxLevel`, con trucos), y el origen con el que se muestran. Con `optionalReplace` y `count: 0`, el nivel solo
 * permite sustituir uno de los que ya da el rasgo por otro que cumpla lo mismo.
 */
export type BonusSpellsPending = {
  class: Ref;
  lists: string[];
  cantripsOnly?: boolean;
  fromSpellbook?: boolean;
  level?: number;
  maxLevel?: number;
  origin: string;
};

export type SpellsPending = {
  class: Ref;
  mode: SpellcastingMode;
  list: string;
  /**
   * Con Secretos mágicos: las listas de las que puede elegir los conjuros nuevos y los sustitutos (incluida `list`);
   * los trucos, solo de `list`.
   */
  lists?: string[];
  cantrips: number;
  spells: number;
  maxLevel: number;
  /** Sabio de la escuela: conjuros de Mago de la escuela `school` (letra de 5etools) que entran gratis en el libro. */
  free?: { count: number; school: string; maxLevel: number };
};

/** Fuente de la elección de conjuros de una clase o subclase lanzadora. */
export const spellsSource = (caster: Ref) => `progression:spells|${bareKey(caster.key)}`;

// "class:barbarian|xphb" → "barbarian|xphb"
const bareKey = (key: string) => key.replace(/^[^:]*:/, "");

/** Opciones de rasgo que dan un truco más de la lista de su clase (Taumaturgo del Clérigo, Mago del Druida). */
export const BONUS_CANTRIPS: Readonly<Record<string, number>> = {
  "classFeature:thaumaturge|cleric|xphb|1": 1,
  "classFeature:magician|druid|xphb|1": 1,
};

/** Trucos de más que dan las opciones de rasgo `options` (claves del catálogo). */
export const bonusCantrips = (options: string[]) => options.reduce((n, k) => n + (BONUS_CANTRIPS[k] ?? 0), 0);

/**
 * Listas de las que una clase elige sus conjuros (no los trucos) en un nivel de clase por Secretos mágicos (con la
 * suya, `list`); vacío si no tiene el rasgo.
 */
export function secretSpellLists(data: Pick<ClassData, "features"> | undefined, classLevel: number, list: string): string[] {
  const extra = (data?.features ?? []).filter((f) => f.level <= classLevel).flatMap((f) => MAGICAL_SECRETS[f.ref.key] ?? []);
  return extra.length ? [...new Set([list, ...extra])] : [];
}
