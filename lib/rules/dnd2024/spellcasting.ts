// Reglas de lanzamiento de conjuros de D&D 2024 (spec de conjuros §2.2 y §2.3): tablas de espacios, nivel de
// lanzador multiclase, nivel máximo de conjuro de una clase y tamaño del libro del Mago. Funciones puras.
import type { ClassProgressions, Ref, SpellcastingProgression } from "@/lib/rules/types";

/** Espacios por nivel de conjuro (1.º, 2.º…) de un lanzador completo de nivel 1..20 (índice 0 = nivel 1). */
export const FULL_CASTER_SLOTS: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Magia de pacto del Brujo de nivel 1..20: número de espacios y su nivel. */
export const PACT_SLOTS: { count: number; level: number }[] = [
  { count: 1, level: 1 }, { count: 2, level: 1 }, { count: 2, level: 2 }, { count: 2, level: 2 },
  { count: 2, level: 3 }, { count: 2, level: 3 }, { count: 2, level: 4 }, { count: 2, level: 4 },
  { count: 2, level: 5 }, { count: 2, level: 5 }, { count: 3, level: 5 }, { count: 3, level: 5 },
  { count: 3, level: 5 }, { count: 3, level: 5 }, { count: 3, level: 5 }, { count: 3, level: 5 },
  { count: 4, level: 5 }, { count: 4, level: 5 }, { count: 4, level: 5 }, { count: 4, level: 5 },
];

const clampLevel = (level: number) => Math.min(Math.max(Math.floor(level), 0), 20);

/** Espacios de un nivel de lanzador (0 = ninguno): `{ "1": 4, "2": 3 }`. */
export function slotsForCasterLevel(level: number): Record<string, number> {
  const row = FULL_CASTER_SLOTS[clampLevel(level) - 1] ?? [];
  return Object.fromEntries(row.map((n, i) => [String(i + 1), n]));
}

/**
 * Nivel de lanzador de una clase sola, para usar la tabla de lanzador completo: medio lanzador redondeando hacia
 * arriba (Paladín y Explorador de 2024) y tercio también hacia arriba (tablas del Caballero arcano y el Embaucador
 * arcano). La Magia de pacto no usa esta tabla.
 */
function singleCasterLevel(progression: SpellcastingProgression, level: number): number {
  if (progression === "full") return level;
  if (progression === "half") return Math.ceil(level / 2);
  // Las subclases tercio lanzan desde el nivel 3 de la clase
  if (progression === "third") return level < 3 ? 0 : Math.ceil(level / 3);
  return 0;
}

/** Nivel de conjuro más alto que puede preparar una clase con su nivel de clase, según su propia progresión. */
export function maxSpellLevel(progression: SpellcastingProgression, classLevel: number): number {
  if (progression === "pact") return PACT_SLOTS[clampLevel(classLevel) - 1]?.level ?? 0;
  return FULL_CASTER_SLOTS[clampLevel(singleCasterLevel(progression, classLevel)) - 1]?.length ?? 0;
}

/**
 * Nivel de lanzador multiclase: niveles de lanzador completo + ½ (hacia arriba) de los medios + ⅓ (hacia abajo) de
 * los tercios. La Magia de pacto va aparte.
 */
export function casterLevel(sources: { progression: SpellcastingProgression; level: number }[]): number {
  let total = 0;
  for (const s of sources) {
    if (s.progression === "full") total += s.level;
    else if (s.progression === "half") total += Math.ceil(s.level / 2);
    else if (s.progression === "third") total += Math.floor(s.level / 3);
  }
  return total;
}

/**
 * Espacios normales de los lanzadores (sin la Magia de pacto): con una sola clase lanzadora, su propia tabla; con
 * varias, la de lanzador multiclase.
 */
export function slotLevels(sources: { progression: SpellcastingProgression; level: number }[]): Record<string, number> {
  const casters = sources.filter((s) => s.progression !== "pact");
  if (casters.length === 1) return slotsForCasterLevel(singleCasterLevel(casters[0].progression, casters[0].level));
  return slotsForCasterLevel(casterLevel(casters));
}

/** Conjuros que tiene que tener el libro en un nivel de clase: la suma de las entradas por nivel (6 + 2 por nivel). */
export function spellbookSize(progressions: Pick<ClassProgressions, "spellbook">, classLevel: number): number {
  return (progressions.spellbook ?? []).slice(0, clampLevel(classLevel)).reduce((a, b) => a + b, 0);
}

/** Clave de `sheet.prepared` para una clase (o subclase lanzadora). */
export const preparedKey = (cls: Ref) => cls.key;

/**
 * Dotes del Manual del Jugador 2024 que dan conjuros, por nombre (sin la variante: «magic initiate; cleric» →
 * «magic initiate»), con los que dan siempre. Los elegidos por el jugador (Iniciado en la magia, Lanzador de
 * rituales…) no se guardan todavía en la elección de la dote.
 */
export const SPELL_FEATS: Record<string, string[]> = {
  "magic initiate": [],
  "ritual caster": [],
  "blessed warrior": [],
  "druidic warrior": [],
  "fey touched": ["misty step"],
  "shadow touched": ["invisibility"],
  telepathic: ["detect thoughts"],
  telekinetic: ["mage hand"],
};

/** Conjuros fijos de una dote del Manual del Jugador 2024, o null si la dote no da conjuros. */
export function featSpells(feat: Ref): Ref[] | null {
  const [name, source] = feat.key.replace(/^[^:]*:/, "").split("|");
  const spells = source === "xphb" ? SPELL_FEATS[name.split(";")[0].trim()] : undefined;
  return spells ? spells.map((s) => ({ book: feat.book, key: `spell:${s}|xphb` })) : null;
}
