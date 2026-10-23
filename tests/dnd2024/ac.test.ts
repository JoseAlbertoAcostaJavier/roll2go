import { describe, expect, it } from "vitest";
import { armorClass, type ArmorData } from "@/lib/rules/dnd2024/derive/ac";

const armor = (ac: number, category: string, dexCap: number | null): ArmorData =>
  ({ ac, category, dexCap, stealthDisadvantage: false });
const base = { dex: 0, con: 0, wis: 0, armor: null, shield: false, unarmored: [] as ("barbarian" | "monk")[] };

describe("armorClass", () => {
  it("cota de malla: CA fija sin DES", () => {
    expect(armorClass({ ...base, dex: 3, armor: armor(16, "heavy", 0) })).toBe(16);
    expect(armorClass({ ...base, dex: -1, armor: armor(16, "heavy", 0) })).toBe(16);
  });
  it("cuero tachonado suma DES completo", () => {
    expect(armorClass({ ...base, dex: 4, armor: armor(12, "light", null) })).toBe(16);
  });
  it("intermedia: DES con tope 2", () => {
    expect(armorClass({ ...base, dex: 4, armor: armor(14, "medium", 2) })).toBe(16);
    expect(armorClass({ ...base, dex: 1, armor: armor(14, "medium", 2) })).toBe(15);
  });
  it("el escudo suma 2", () => {
    expect(armorClass({ ...base, dex: 4, armor: armor(14, "medium", 2), shield: true })).toBe(18);
    expect(armorClass({ ...base, dex: 2, shield: true })).toBe(14);
  });
  it("sin armadura: 10 + DES", () => {
    expect(armorClass({ ...base, dex: 2 })).toBe(12);
  });
  it("Bárbaro sin armadura: 10 + DES + CON, también con escudo", () => {
    const barb = { ...base, dex: 2, con: 1, unarmored: ["barbarian" as const] };
    expect(armorClass(barb)).toBe(13);
    expect(armorClass({ ...barb, shield: true })).toBe(15);
  });
  it("Monje sin armadura: 10 + DES + SAB; con escudo, 10 + DES + escudo", () => {
    const monk = { ...base, dex: 3, wis: 2, unarmored: ["monk" as const] };
    expect(armorClass(monk)).toBe(15);
    expect(armorClass({ ...monk, shield: true })).toBe(10 + 3 + 2);
  });
  it("con ambas Defensas sin armadura usa la mayor", () => {
    expect(armorClass({ ...base, dex: 2, con: 1, wis: 3, unarmored: ["barbarian", "monk"] })).toBe(15);
    expect(armorClass({ ...base, dex: 2, con: 1, wis: 3, shield: true, unarmored: ["barbarian", "monk"] })).toBe(15);
  });
  it("la armadura anula la Defensa sin armadura", () => {
    expect(armorClass({ ...base, dex: 2, con: 3, armor: armor(12, "light", null), unarmored: ["barbarian"] })).toBe(14);
  });
});
