import { describe, expect, it } from "vitest";
import { evalUses, type UsesVars } from "@/lib/rules/dnd2024/derive/usesFormula";

const vars = (over: Partial<UsesVars> = {}): UsesVars => ({
  prof: 3,
  mods: { str: 0, dex: 0, con: 0, int: 3, wis: 0, cha: -1 },
  classLevels: { wizard: 3 },
  scale: () => null,
  ...over,
});

describe("evalUses", () => {
  it("@prof, max con modificador negativo y niveles de clase", () => {
    expect(evalUses("@prof", vars())).toBe(3);
    expect(evalUses("max(1,@abilities.cha.mod)", vars())).toBe(1);
    expect(evalUses("(2 * @classes.wizard.levels) + @abilities.int.mod", vars())).toBe(9);
    expect(evalUses("@classes.cleric.levels", vars())).toBe(0);
  });
  it("@scale lee la columna de la clase; sin escala, null", () => {
    const scale = (c: string, col: string) => (c === "barbarian" && col === "rages" ? 3 : null);
    expect(evalUses("@scale.barbarian.rages", vars({ scale }))).toBe(3);
    expect(evalUses("@scale.barbarian.rage-damage", vars({ scale }))).toBeNull();
    expect(evalUses("@scale.psi-warrior.die.number", vars())).toBeNull();
  });
  it("operadores, precedencia, min, floor y redondeo hacia abajo", () => {
    expect(evalUses("1 + 2 * 3", vars())).toBe(7);
    expect(evalUses("-(1 + 2) + 10", vars())).toBe(7);
    expect(evalUses("min(floor(@classes.wizard.levels / 2), 5)", vars())).toBe(1);
    expect(evalUses("7 / 2", vars())).toBe(3);
    expect(evalUses("@prof-1", vars())).toBe(2);
  });
  it("lo desconocido o mal formado da null", () => {
    for (const f of ["1; drop table", "", "foo(1)", "@nope", "@abilities.xyz.mod", "(1", "1 +", "1 / 0", "max()", "constructor(1)", "1 2"]) {
      expect(evalUses(f, vars()), f).toBeNull();
    }
  });
});
