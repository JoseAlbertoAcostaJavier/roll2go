import { describe, expect, it } from "vitest";
import {
  POINT_BUY_TOTAL, STANDARD_ARRAY, checkBackgroundBonus, pointBuyCost, rollAbilityScores,
} from "@/lib/rules/dnd2024/abilities";

const scores = (a: number, b: number, c: number, d: number, e: number, f: number) =>
  ({ str: a, dex: b, con: c, int: d, wis: e, cha: f });

describe("abilities", () => {
  it("calcula el coste del reparto de puntos", () => {
    expect(pointBuyCost(scores(15, 15, 15, 8, 8, 8))).toBe(POINT_BUY_TOTAL);
    expect(pointBuyCost(scores(8, 8, 8, 8, 8, 8))).toBe(0);
    expect(pointBuyCost(scores(16, 8, 8, 8, 8, 8))).toBe(Infinity);
  });
  it("valores predefinidos", () => {
    expect(STANDARD_ARRAY).toEqual([15, 14, 13, 12, 10, 8]);
  });
  it("bonificación del trasfondo", () => {
    const allowed: ("int" | "wis" | "cha")[] = ["int", "wis", "cha"];
    expect(checkBackgroundBonus({ int: 2, wis: 1 }, allowed)).toBe(true);
    expect(checkBackgroundBonus({ str: 2, wis: 1 }, allowed)).toBe(false);
    expect(checkBackgroundBonus({ int: 3 }, allowed)).toBe(false);
    expect(checkBackgroundBonus({ int: 1, wis: 1, cha: 1 }, allowed)).toBe(true);
    expect(checkBackgroundBonus({ int: 2 }, allowed)).toBe(false);
    expect(checkBackgroundBonus({}, allowed)).toBe(false);
  });
  it("tira 4d6 sin el menor, seis veces", () => {
    expect(rollAbilityScores(() => 0)).toEqual([3, 3, 3, 3, 3, 3]);
    expect(rollAbilityScores(() => 0.99)).toEqual([18, 18, 18, 18, 18, 18]);
    const seq = [0, 0.5, 0.99, 0.2]; // dados 1,4,6,2 -> 4+6+2
    let i = 0;
    expect(rollAbilityScores(() => seq[i++ % 4])[0]).toBe(12);
  });
});
