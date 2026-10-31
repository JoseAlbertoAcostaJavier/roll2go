import { describe, expect, it } from "vitest";
import { armorClass, armorClassBreakdown, type ArmorData } from "@/lib/rules/dnd2024/derive/ac";

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

describe("armorClassBreakdown", () => {
  const named = (a: ArmorData, name: string) => ({ ...a, name });
  it("armadura media con escudo: Destreza con tope 2", () => {
    const b = armorClassBreakdown({ ...base, dex: 3, armor: named(armor(14, "medium", 2), "Coraza"), shield: true });
    expect(b.parts).toEqual([
      { label: "Armadura: Coraza", value: 14 },
      { label: "Modificador de Destreza (máx. 2)", value: 2 },
      { label: "Escudo", value: 2 },
    ]);
    expect(b.total).toBe(18);
  });
  it("armadura pesada: sin parte de Destreza", () => {
    const b = armorClassBreakdown({ ...base, dex: 3, armor: named(armor(16, "heavy", 0), "Cota de malla") });
    expect(b.parts).toEqual([{ label: "Armadura: Cota de malla", value: 16 }]);
  });
  it("armadura ligera: Destreza completa", () => {
    const b = armorClassBreakdown({ ...base, dex: 4, armor: named(armor(12, "light", null), "Cuero tachonado") });
    expect(b.parts).toEqual([
      { label: "Armadura: Cuero tachonado", value: 12 }, { label: "Modificador de Destreza", value: 4 },
    ]);
  });
  it("sin armadura: 10 + Destreza", () => {
    expect(armorClassBreakdown({ ...base, dex: -1 }).parts)
      .toEqual([{ label: "Sin armadura", value: 10 }, { label: "Modificador de Destreza", value: -1 }]);
  });
  it("Defensa sin armadura del Bárbaro", () => {
    const b = armorClassBreakdown({ ...base, dex: 2, con: 3, unarmored: ["barbarian"] });
    expect(b.parts).toEqual([
      { label: "Defensa sin armadura (Bárbaro)", value: 10 },
      { label: "Modificador de Destreza", value: 2 },
      { label: "Modificador de Constitución", value: 3 },
    ]);
    expect(b.total).toBe(15);
  });
  it("Defensa sin armadura del Monje; con escudo no se usa", () => {
    const monk = { ...base, dex: 3, wis: 2, unarmored: ["monk" as const] };
    expect(armorClassBreakdown(monk).parts).toEqual([
      { label: "Defensa sin armadura (Monje)", value: 10 },
      { label: "Modificador de Destreza", value: 3 },
      { label: "Modificador de Sabiduría", value: 2 },
    ]);
    expect(armorClassBreakdown({ ...monk, shield: true }).parts).toEqual([
      { label: "Sin armadura", value: 10 }, { label: "Modificador de Destreza", value: 3 }, { label: "Escudo", value: 2 },
    ]);
  });
  it("Bárbaro y Monje: solo las partes de la que da más", () => {
    const both = { ...base, dex: 2, con: 1, wis: 3, unarmored: ["barbarian", "monk"] as ("barbarian" | "monk")[] };
    expect(armorClassBreakdown(both).parts.map((p) => p.label))
      .toEqual(["Defensa sin armadura (Monje)", "Modificador de Destreza", "Modificador de Sabiduría"]);
    expect(armorClassBreakdown({ ...both, con: 4 }).parts.map((p) => p.label))
      .toEqual(["Defensa sin armadura (Bárbaro)", "Modificador de Destreza", "Modificador de Constitución"]);
    // Con escudo, la del Monje no cuenta
    expect(armorClassBreakdown({ ...both, shield: true }).parts.map((p) => p.label))
      .toEqual(["Defensa sin armadura (Bárbaro)", "Modificador de Destreza", "Modificador de Constitución", "Escudo"]);
  });
  it("el total coincide con armorClass", () => {
    const cases = [
      { ...base, dex: 4, armor: named(armor(14, "medium", 2), "X"), shield: true },
      { ...base, dex: 2, con: 1, wis: 3, unarmored: ["barbarian", "monk"] as ("barbarian" | "monk")[] },
      { ...base, dex: 2, shield: true },
    ];
    for (const c of cases) expect(armorClassBreakdown(c).total).toBe(armorClass(c));
  });
});
