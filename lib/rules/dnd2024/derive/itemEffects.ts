// Efectos de los objetos mágicos en la ficha. Un objeto que requiere sintonización solo funciona sintonizado (y, si es arma o
// armadura, además equipado); el que no la requiere, al equiparlo. Módulo puro.
import { fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { ABILITIES, type Ability, type ItemBonuses, type ItemData } from "@/lib/rules/types";
import { modOf } from "./abilities";
import { makeBreakdown, type Breakdown, type Part } from "./breakdown";

const SCORE_CAP = 20;

export type ActiveItem = { name: string; data: ItemData };
type Line = { equipped?: boolean; attuned?: boolean };

export const itemIsActive = (line: Line, data: ItemData): boolean => (data.attunement
  ? !!line.attuned && (!(data.weapon || data.armor) || !!line.equipped)
  : !!line.equipped);

type NumericBonus = "ac" | "saves" | "spellAttack" | "spellDc";

/** Una parte de desglose por cada objeto activo que dé ese bonificador. */
export const bonusParts = (active: ActiveItem[], bonus: NumericBonus): Part[] =>
  active.flatMap((i) => (i.data.bonuses?.[bonus] ? [{ label: i.name, value: i.data.bonuses[bonus]! }] : []));

export const bonusTotal = (active: ActiveItem[], bonus: NumericBonus): number =>
  bonusParts(active, bonus).reduce((t, p) => t + p.value, 0);

/** El bonificador a ataque y daño de un arma, si funciona: el de un arma con sintonización exige tenerla sintonizada. */
export const weaponMagic = (line: Line, data: ItemData): Pick<ItemBonuses, "attack" | "damage"> =>
  (data.attunement && !line.attuned ? {} : { attack: data.bonuses?.attack, damage: data.bonuses?.damage });

/** Añade a las características las sumas (hasta 20) y, después, la mayor puntuación fija de los objetos activos. */
export function withItemScores(breakdowns: Record<Ability, Breakdown>, active: ActiveItem[]): Record<Ability, Breakdown> {
  return Object.fromEntries(ABILITIES.map((a) => {
    const parts = [...breakdowns[a].parts];
    const sum = () => parts.reduce((t, p) => t + p.value, 0);
    for (const i of active) {
      const add = i.data.bonuses?.addScores?.[a];
      const room = add ? Math.min(add, SCORE_CAP - sum()) : 0;
      if (room > 0) parts.push({ label: i.name, value: room });
    }
    const best = active.reduce<{ name: string; score: number } | null>((b, i) => {
      const score = i.data.bonuses?.setScores?.[a];
      return score && score > (b?.score ?? 0) ? { name: i.name, score } : b;
    }, null);
    if (best && best.score > sum()) parts.push({ label: best.name, value: best.score - sum() });
    if (parts.length === breakdowns[a].parts.length) return [a, breakdowns[a]];
    return [a, makeBreakdown(parts, [`Modificador ${fmtMod(modOf(sum()))}`])];
  })) as Record<Ability, Breakdown>;
}

/** La velocidad con la mayor de las que fijan los objetos activos, si supera la del personaje. */
export function withItemSpeed(speed: Breakdown, active: ActiveItem[]): Breakdown {
  const best = active.reduce<{ name: string; walk: number } | null>((b, i) => {
    const walk = i.data.bonuses?.walk;
    return walk && walk > (b?.walk ?? 0) ? { name: i.name, walk } : b;
  }, null);
  return best && best.walk > speed.total
    ? makeBreakdown([...speed.parts, { label: best.name, value: best.walk - speed.total }], speed.notes)
    : speed;
}
