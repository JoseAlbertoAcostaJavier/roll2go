// Modo de lanzamiento de cada clase y subclase lanzadora del Manual del Jugador 2024 (XPHB), por clave del catálogo.
//  - `list`: prepara de la lista de su clase y cambia los preparados en la ficha cuando quiere.
//  - `levelUp`: aprende conjuros al subir de nivel (y puede sustituir uno); los preparados son los aprendidos.
//  - `spellbook`: prepara de su libro de conjuros, que crece al subir de nivel y copiando conjuros.
import type { SpellcastingMode } from "@/lib/rules/types";

export const SPELLCASTING_MODES: Record<string, SpellcastingMode> = {
  "class:cleric|xphb": "list",
  "class:druid|xphb": "list",
  "class:paladin|xphb": "list",
  "class:bard|xphb": "levelUp",
  "class:ranger|xphb": "levelUp",
  "class:sorcerer|xphb": "levelUp",
  "class:warlock|xphb": "levelUp",
  "class:wizard|xphb": "spellbook",
  "subclass:eldritch knight|fighter|xphb": "levelUp",
  "subclass:arcane trickster|rogue|xphb": "levelUp",
};

/**
 * Modo de una clase o subclase: el de la tabla y, si no está (otros libros), el que se deduce de sus datos de
 * 5etools: libro fijo → `spellbook`; preparados que cambian al subir de nivel → `levelUp`; si no, `list`.
 */
export function spellcastingMode(key: string, raw: { spellsKnownProgressionFixed?: unknown; preparedSpellsChange?: unknown }): SpellcastingMode {
  if (SPELLCASTING_MODES[key]) return SPELLCASTING_MODES[key];
  if (Array.isArray(raw.spellsKnownProgressionFixed)) return "spellbook";
  return raw.preparedSpellsChange === "level" ? "levelUp" : "list";
}
