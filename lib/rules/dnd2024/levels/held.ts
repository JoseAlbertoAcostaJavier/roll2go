// Lo que conserva el personaje de las elecciones de su historial de niveles (dotes, rasgos opcionales, conjuros,
// arcanos), con las sustituciones aplicadas en orden. Funciones puras.
import type { Ref } from "@/lib/rules/types";
import { refKey } from "../sheet/equipmentRefs";
import type { Choice, Dnd2024SheetV2, FeatPickValue, LevelEntry, Named, SpellChoice, SpellSwap } from "../sheet/sheet";
import { bonusCantrips } from "./spellPending";

/** Trucos de más de una clase por las opciones de rasgo elegidas en sus niveles del historial. */
export function heldBonusCantrips(levels: LevelEntry[], cls: Ref): number {
  return bonusCantrips(levels.filter((l) => refKey(l.class.ref) === refKey(cls))
    .flatMap((l) => l.choices.flatMap((c) => (c.type === "featureOption" ? [c.value.ref.key] : []))));
}

// Sustituye en `list` el conjuro que sale por el que entra
function applySwap(list: Named[], swap: SpellSwap | undefined) {
  if (!swap) return;
  const i = list.findIndex((s) => refKey(s.ref) === refKey(swap.out.ref));
  if (i >= 0) list.splice(i, 1);
  list.push(swap.in);
}

/**
 * Trucos y conjuros elegidos para una clase en el historial (en modo `spellbook`, las entradas del libro, también las
 * gratis del Sabio de la escuela), con las sustituciones aplicadas en orden.
 */
export function chosenSpells(sheet: Pick<Dnd2024SheetV2, "levels">, cls: Ref): { cantrips: Named[]; spells: Named[] } {
  const cantrips: Named[] = [];
  const spells: Named[] = [];
  for (const l of sheet.levels) {
    for (const c of l.choices) {
      if (c.type !== "spells" || refKey(c.value.class) !== refKey(cls)) continue;
      const v: SpellChoice = c.value;
      cantrips.push(...v.cantrips);
      spells.push(...v.spells, ...(v.free ?? []));
      // El truco sustituido sale de los trucos y el conjuro, de los aprendidos
      applySwap(cantrips, v.replaceCantrip);
      applySwap(spells, v.replace);
    }
  }
  return { cantrips, spells };
}

// Elecciones de un tipo hechas en los niveles de una clase
export function classChoices<T extends Choice["type"]>(
  levels: LevelEntry[], cls: Ref, type: T,
): Extract<Choice, { type: T }>[] {
  return levels.filter((l) => refKey(l.class.ref) === refKey(cls))
    .flatMap((l) => l.choices.filter((c): c is Extract<Choice, { type: T }> => c.type === type));
}

/** Arcanos (Arcano místico) que conserva una clase: los elegidos en sus niveles, con las sustituciones en orden. */
export function heldArcana(levels: LevelEntry[], cls: Ref): Named[] {
  const held: Named[] = [];
  for (const c of classChoices(levels, cls, "arcanum")) {
    if (c.value) held.push(c.value);
    applySwap(held, c.replace);
  }
  return held;
}

/**
 * Conjuros que conserva una clase de cada elección `bonusSpells` (por `source`: Descubrimientos mágicos…), con las
 * sustituciones aplicadas en orden.
 */
export function heldBonusSpells(levels: LevelEntry[], cls: Ref): Map<string, Named[]> {
  const held = new Map<string, Named[]>();
  for (const c of classChoices(levels, cls, "bonusSpells")) {
    const list = held.get(c.source) ?? [];
    list.push(...c.value.spells);
    applySwap(list, c.value.replace);
    held.set(c.source, list);
  }
  return held;
}

/**
 * Dotes y rasgos opcionales que el personaje conserva de cada elección (por `source`): las elegidas en el historial
 * menos las que se sustituyeron después.
 */
export function heldPicks(levels: LevelEntry[]): Map<string, FeatPickValue[]> {
  const held = new Map<string, FeatPickValue[]>();
  for (const l of levels) {
    for (const c of l.choices) {
      if (c.type !== "feat" && c.type !== "optionalFeature") continue;
      const gone = new Set((c.replaced ?? []).map((r) => refKey(r.ref)));
      held.set(c.source, [...(held.get(c.source) ?? []).filter((p) => !gone.has(refKey(p.ref))), ...c.value]);
    }
  }
  return held;
}

// Lo que conserva de las elecciones de tipo `type`, con el nivel total en que se ganó y la elección que lo dio
function heldWithLevel(levels: LevelEntry[], type: "feat" | "optionalFeature") {
  const held = heldPicks(levels);
  // Si se volvió a elegir una que se había sustituido, cuenta la última vez
  const last = new Map<string, FeatPickValue & { level: number; source: string }>();
  for (const l of levels) {
    for (const c of l.choices) {
      if (c.type !== type) continue;
      for (const f of c.value) {
        if (held.get(c.source)?.some((h) => refKey(h.ref) === refKey(f.ref))) {
          last.set(`${c.source}|${refKey(f.ref)}`, { ...f, level: l.n, source: c.source });
        }
      }
    }
  }
  return [...last.values()];
}

/** Dotes de las elecciones `feat` (estilos de combate, dones épicos…) que conserva, con el nivel total en que se ganaron. */
export function heldFeats(levels: LevelEntry[]): (FeatPickValue & { level: number })[] {
  // (sin `source`, que solo usan los rasgos opcionales)
  return heldWithLevel(levels, "feat")
    .map(({ ref, name, ability, resist, level }) => ({
      ref, name, level, ...(ability ? { ability } : {}), ...(resist ? { resist } : {}),
    }));
}

/**
 * Rasgos opcionales (metamagia, invocaciones, maniobras) que conserva, con el nivel total en que se ganaron y la
 * progresión que los da (`progression:maneuvers|…`).
 */
export function heldOptionalFeatures(levels: LevelEntry[]): (Named & { level: number; source: string })[] {
  return heldWithLevel(levels, "optionalFeature");
}
