// Elección de conjuros en el creador y en el asistente de subir de nivel (spec de conjuros §4.2 y §4.3): lo que lleva
// marcado el usuario (claves `libro:clave`), lo que le falta y la elección `spells` que se envía. Funciones puras.
import type { Ref } from "@/lib/rules/types";
import type { PendingChoice } from "./levels";
import type { Choice, SpellChoice } from "./sheet";

/** Sustitución: el conjuro que sale y el que entra ("" = sin elegir). */
export type SwapPick = { out: string; in: string };

/** Lo marcado en la elección de conjuros: trucos y conjuros nuevos (o entradas del libro) y las sustituciones. */
export type SpellPick = { cantrips: string[]; spells: string[]; replace: SwapPick; replaceCantrip: SwapPick };

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
  return { cantrips: keys(v.cantrips), spells: keys(v.spells), replace: swap(v.replace), replaceCantrip: swap(v.replaceCantrip) };
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
  };
  for (const s of swaps(p, v)) {
    if (s.allowed && s.value.out && s.value.in) value[s.field] = { out: named(s.value.out), in: named(s.value.in) };
  }
  if (p.count === 0 && !value.replace && !value.replaceCantrip) return null;
  return { type: "spells", source: p.source, value };
}
