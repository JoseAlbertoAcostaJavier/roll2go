// Elección de conjuros en el creador y en el asistente de subir de nivel (spec de conjuros §4.2 y §4.3): lo que lleva
// marcado el usuario (claves `libro:clave`), lo que le falta y la elección `spells` que se envía. Funciones puras.
import type { SpellOption } from "@/lib/rules/catalog/types";
import type { Ability, Ref } from "@/lib/rules/types";
import type { PendingChoice } from "../levels/pendingChoices";
import type { Choice, SpellChoice } from "../sheet/sheet";

/** Sustitución: el conjuro que sale y el que entra ("" = sin elegir). */
export type SwapPick = { out: string; in: string };

/**
 * Lo marcado en la elección de conjuros: trucos y conjuros nuevos (o entradas del libro) y las sustituciones. `free`:
 * las entradas gratis del Sabio de la escuela; `list`: la lista elegida en una dote con listas alternativas (Iniciado
 * en la magia base). En el Arcano místico y en los conjuros de rasgos (`bonusSpells`), los elegidos van en `spells` y
 * la sustitución en `replace`.
 */
export type SpellPick = {
  cantrips: string[]; spells: string[]; replace: SwapPick; replaceCantrip: SwapPick; free?: string[]; list?: string;
};

export const emptySpellPick = (): SpellPick => ({
  cantrips: [], spells: [], replace: { out: "", in: "" }, replaceCantrip: { out: "", in: "" },
});

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const keys = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === "string" && !!s))] : []);
const swap = (v: unknown): SwapPick =>
  isObj(v) ? { out: typeof v.out === "string" ? v.out : "", in: typeof v.in === "string" ? v.in : "" } : { out: "", in: "" };

/** Recupera lo marcado de un borrador; lo que no encaja se descarta. */
export function parseSpellPick(v: unknown): SpellPick {
  if (!isObj(v)) return emptySpellPick();
  const free = keys(v.free);
  return {
    cantrips: keys(v.cantrips), spells: keys(v.spells), replace: swap(v.replace), replaceCantrip: swap(v.replaceCantrip),
    ...(free.length ? { free } : {}), ...(typeof v.list === "string" && v.list ? { list: v.list } : {}),
  };
}

/** `libro:clave` → referencia (los ids de libro no llevan «:»). */
const refOf = (k: string): Ref => ({ book: k.slice(0, k.indexOf(":")), key: k.slice(k.indexOf(":") + 1) });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Las sustituciones que permite la elección y lo marcado en cada una
function swaps(p: PendingChoice, pick: SpellPick) {
  return [
    { field: "replaceCantrip", cantrip: true, allowed: !!p.optionalReplaceCantrip, value: pick.replaceCantrip },
    { field: "replace", cantrip: false, allowed: !!p.optionalReplace && p.spells?.mode === "levelUp", value: pick.replace },
  ] as const;
}

/** Lo que falta en la elección de conjuros («elegir 2 trucos»…); null si está completa. */
export function spellPickMissing(p: PendingChoice, pick: SpellPick | undefined): string | null {
  if (!p.spells) return null;
  const v = pick ?? emptySpellPick();
  const cantrips = p.spells.cantrips - v.cantrips.slice(0, p.spells.cantrips).length;
  if (cantrips > 0) return `elegir ${plural(cantrips, "truco", "trucos")}`;
  const spells = p.spells.spells - v.spells.slice(0, p.spells.spells).length;
  if (spells > 0) {
    return `elegir ${plural(spells, "conjuro", "conjuros")}${p.spells.mode === "spellbook" ? " para el libro" : ""}`;
  }
  // Una sustitución a medias: o las dos partes o ninguna
  for (const s of swaps(p, v)) {
    if (!s.allowed) continue;
    const what = s.cantrip ? "truco" : "conjuro";
    if (s.value.out && !s.value.in) return `elegir el ${what} que entra`;
    if (!s.value.out && s.value.in) return `elegir el ${what} que sale`;
  }
  return null;
}

/**
 * Elección `spells` para enviar (sin nombres: los pone el servidor). Sin nada nuevo que elegir y sin sustituciones,
 * no se envía (null).
 */
export function spellChoiceOf(p: PendingChoice, pick: SpellPick | undefined): Choice | null {
  if (!p.spells) return null;
  const v = pick ?? emptySpellPick();
  const named = (k: string) => ({ ref: refOf(k), name: "" });
  const value: SpellChoice = {
    class: p.spells.class,
    cantrips: v.cantrips.slice(0, p.spells.cantrips).map(named),
    spells: v.spells.slice(0, p.spells.spells).map(named),
    // Sabio de la escuela: de 0 a su número
    ...(p.spells.free ? { free: (v.free ?? []).slice(0, p.spells.free.count).map(named) } : {}),
  };
  for (const s of swaps(p, v)) {
    if (s.allowed && s.value.out && s.value.in) value[s.field] = { out: named(s.value.out), in: named(s.value.in) };
  }
  if (p.count === 0 && !value.replace && !value.replaceCantrip) return null;
  return { type: "spells", source: p.source, value };
}

/**
 * Lo que falta en la elección de conjuros de una dote: la lista (si la dote deja elegirla y hay algo que elegir con
 * ella), sus conjuros y, si la dote la deja elegir, la característica.
 */
export function featSpellsMissing(p: PendingChoice, pick: SpellPick | undefined, ability: Ability | "" | undefined): string | null {
  const v = pick ?? emptySpellPick();
  const lists = p.featSpells?.lists;
  const swapping = !!(v.replace.out || v.replace.in);
  if (lists && (p.count > 0 || swapping) && !lists.includes(v.list ?? "")) return "elegir la lista de conjuros";
  return spellPickMissing(p, pick)
    ?? (p.featSpells?.abilities && !p.featSpells.abilities.includes(ability as Ability) ? "elegir la característica de lanzamiento" : null);
}

/**
 * Elección `featSpells` para enviar (sin nombres: los pone el servidor), con la lista elegida y el cambio opcional de
 * uno de sus conjuros. Si el nivel solo permite ese cambio y no se hace, no se envía (null).
 */
export function featSpellsChoiceOf(p: PendingChoice, pick: SpellPick | undefined, ability: Ability | "" | undefined): Choice | null {
  const v = pick ?? emptySpellPick();
  const named = (k: string) => ({ ref: refOf(k), name: "" });
  const list = p.featSpells?.lists?.includes(v.list ?? "") ? v.list : undefined;
  const replace = p.optionalReplace && v.replace.out && v.replace.in
    ? { out: named(v.replace.out), in: named(v.replace.in) } : undefined;
  if (p.count === 0 && !replace) return null;
  return {
    type: "featSpells", source: p.source,
    value: {
      feat: p.featSpells?.feat ?? p.spells!.class,
      ...(list ? { list } : {}),
      cantrips: v.cantrips.slice(0, p.spells?.cantrips ?? 0).map(named),
      spells: v.spells.slice(0, p.spells?.spells ?? 0).map(named),
      ...(ability && p.featSpells?.abilities?.includes(ability) ? { ability } : {}),
      ...(replace ? { replace } : {}),
    },
  };
}

/**
 * Lo que falta en una elección de Arcano místico o de conjuros de un rasgo (`bonusSpells`): los conjuros que pide
 * (`count`) y, si se sustituye uno, las dos partes.
 */
export function bonusPickMissing(p: PendingChoice, pick: SpellPick | undefined): string | null {
  const v = pick ?? emptySpellPick();
  const left = p.count - v.spells.slice(0, p.count).length;
  if (left > 0) return `elegir ${plural(left, "conjuro", "conjuros")} en ${p.label}`;
  if (p.optionalReplace && v.replace.out && !v.replace.in) return "elegir el conjuro que entra";
  if (p.optionalReplace && !v.replace.out && v.replace.in) return "elegir el conjuro que sale";
  return null;
}

/**
 * Elección `arcanum` o `bonusSpells` para enviar (sin nombres: los pone el servidor). Si el nivel solo permite sustituir
 * uno y no se hace, no se envía (null).
 */
export function bonusChoiceOf(p: PendingChoice, pick: SpellPick | undefined): Choice | null {
  const v = pick ?? emptySpellPick();
  const named = (k: string) => ({ ref: refOf(k), name: "" });
  const spells = v.spells.slice(0, p.count).map(named);
  const replace = p.optionalReplace && v.replace.out && v.replace.in
    ? { out: named(v.replace.out), in: named(v.replace.in) } : undefined;
  if (p.count === 0 && !replace) return null;
  if (p.type === "arcanum") {
    return { type: "arcanum", source: p.source, value: spells[0] ?? null, ...(replace ? { replace } : {}) };
  }
  if (p.type === "bonusSpells") {
    return { type: "bonusSpells", source: p.source, value: { spells, ...(replace ? { replace } : {}) } };
  }
  return null;
}

const spellName = (s: SpellOption) => s.nameEs ?? s.name;

/**
 * Nivel más alto que se puede marcar en la lista: `maxLevel` si se eligen conjuros (nuevos, gratis o el que sustituye a
 * uno aprendido); si solo se eligen trucos, 0.
 */
export function pickableMaxLevel(o: { maxLevel: number; spells: number; free?: boolean; replaceSpell?: boolean }): number {
  return o.spells > 0 || o.free || o.replaceSpell ? o.maxLevel : 0;
}

/**
 * Los trucos y conjuros que se pueden elegir al aprender:los de la lista de la clase (o de `extraLists`, solo de nivel 1
 * o más, en Secretos mágicos; o los que cumpla `accepts`), con los conjuros hasta `maxLevel`. Ordenados por nivel y nombre.
 */
export function classSpellOptions(
  spells: SpellOption[],
  o: { listId: string; maxLevel: number; extraLists?: string[]; accepts?: (s: SpellOption) => boolean },
): SpellOption[] {
  const { listId, maxLevel, extraLists, accepts } = o;
  return spells
    .filter((s) => s.data.level <= maxLevel && (accepts ? accepts(s)
      : s.data.classes.includes(listId)
        || (!!extraLists && s.data.level >= 1 && s.data.classes.some((c) => extraLists.includes(c)))))
    .sort((a, b) => a.data.level - b.data.level || spellName(a).localeCompare(spellName(b), "es"));
}
