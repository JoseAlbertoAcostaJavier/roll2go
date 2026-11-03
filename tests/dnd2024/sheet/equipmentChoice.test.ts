import { describe, expect, test } from "vitest";
import { choiceMatches } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { ItemData } from "@/lib/rules/types";

const item = (type: string, category?: string): ItemData => ({
  type, weight: 1, value: 1,
  ...(category ? { weapon: { damage: "1d6", damageType: "S", properties: [], category } } : {}),
});

describe("choiceMatches", () => {
  test("juegos, instrumentos y herramientas por tipo", () => {
    expect(choiceMatches("gaming", item("GS"))).toBe(true);
    expect(choiceMatches("gaming", item("INS"))).toBe(false);
    expect(choiceMatches("instrument", item("INS"))).toBe(true);
    expect(choiceMatches("artisan", item("AT"))).toBe(true);
    expect(choiceMatches("artisan", item("T"))).toBe(false);
  });
  test("armas por categoría y cuerpo a cuerpo", () => {
    expect(choiceMatches("simple", item("R", "simple"))).toBe(true);
    expect(choiceMatches("simple", item("M", "martial"))).toBe(false);
    expect(choiceMatches("martial", item("R", "martial"))).toBe(true);
    expect(choiceMatches("simpleMelee", item("M", "simple"))).toBe(true);
    expect(choiceMatches("simpleMelee", item("R", "simple"))).toBe(false);
    expect(choiceMatches("martialMelee", item("M", "martial"))).toBe(true);
    expect(choiceMatches("martialMelee", item("M", "simple"))).toBe(false);
    expect(choiceMatches("martial", item("G"))).toBe(false);
  });
});
