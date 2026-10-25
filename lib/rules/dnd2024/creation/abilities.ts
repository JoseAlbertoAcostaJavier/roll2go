import { ABILITIES, type Ability } from "@/lib/rules/types";

export const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUY_TOTAL = 27;
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

/** Coste total del reparto de puntos; `Infinity` si algún valor está fuera de 8-15. */
export function pointBuyCost(scores: Record<Ability, number>): number {
  let total = 0;
  for (const a of ABILITIES) {
    const cost = POINT_BUY_COST[scores[a]];
    if (cost === undefined) return Infinity;
    total += cost;
  }
  return total;
}

/** Bonificación del trasfondo: +2/+1 o +1/+1/+1, solo en las características permitidas. */
export function checkBackgroundBonus(bonus: Partial<Record<Ability, number>>, allowed: Ability[]): boolean {
  const entries = Object.entries(bonus).filter(([, v]) => v !== 0 && v !== undefined);
  for (const [a, v] of entries) {
    if (!allowed.includes(a as Ability) || (v !== 1 && v !== 2)) return false;
  }
  const values = entries.map(([, v]) => v as number).sort((x, y) => y - x);
  return (values.length === 2 && values[0] === 2 && values[1] === 1) ||
    (values.length === 3 && values.every((v) => v === 1));
}

// 4d6 descartando el menor, seis veces
export function rollAbilityScores(rng: () => number = Math.random): number[] {
  return Array.from({ length: 6 }, () => {
    const dice = Array.from({ length: 4 }, () => Math.floor(rng() * 6) + 1).sort((a, b) => a - b);
    return dice[1] + dice[2] + dice[3];
  });
}
