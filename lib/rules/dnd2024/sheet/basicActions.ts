// Qué acciones básicas de combate salen en la ficha. Por defecto, las de las reglas básicas; fuera de una campaña que restrinja
// libros, el jugador activa o desactiva las que quiera. En esa campaña salen las de sus libros permitidos, sin elegir.
// Las que no tienen texto oficial en español admiten nombre y descripción propios, que solo cambian esta ficha. Módulo puro.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { BasicActionChoices } from "./sheet";
import { refKey } from "./equipmentRefs";

export type BasicActionRules = {
  /** Ids de los libros de reglas básicas. */
  coreBooks: string[];
  /** La campaña del personaje limita los libros: manda ella y no hay nada que elegir. */
  restricted: boolean;
};

export const isCoreAction = (e: CatalogEntry, rules: BasicActionRules) => rules.coreBooks.includes(e.ref.book);
/** Sin texto oficial en español se puede poner uno propio. */
export const isEditableAction = (e: CatalogEntry) => !e.descriptionEs;

export function isActionActive(e: CatalogEntry, choices: BasicActionChoices, rules: BasicActionRules): boolean {
  if (rules.restricted) return true;
  const key = refKey(e.ref);
  return isCoreAction(e, rules) ? !choices.off.includes(key) : choices.on.includes(key);
}

/** La entrada con el nombre y la descripción que le haya puesto el jugador. */
export function withActionEdit(e: CatalogEntry, choices: BasicActionChoices): CatalogEntry {
  const edit = isEditableAction(e) ? choices.edits.find((x) => x.key === refKey(e.ref)) : undefined;
  return edit ? { ...e, nameEs: edit.name, descriptionEs: edit.details } : e;
}

/** Las acciones que salen en la ficha, ya con los retoques del jugador. */
export const shownActions = (all: CatalogEntry[], choices: BasicActionChoices, rules: BasicActionRules): CatalogEntry[] =>
  all.filter((e) => isActionActive(e, choices, rules)).map((e) => withActionEdit(e, choices));
