import { describe, expect, it } from "vitest";
import { d20Expr, diceIn } from "@/lib/utils/diceText";

describe("expresiones de dados", () => {
  it("d20 con su bonificador, también negativo o cero", () => {
    expect(d20Expr(5)).toBe("1d20+5");
    expect(d20Expr(-1)).toBe("1d20-1");
    expect(d20Expr(0)).toBe("1d20+0");
  });

  it("toma la primera expresión de un texto de daño; sin dados, nada", () => {
    expect(diceIn("1d6-1 / 1d8-1 (dos manos)")).toBe("1d6-1");
    expect(diceIn("3d6")).toBe("3d6");
    expect(diceIn("0")).toBeNull();
    expect(diceIn("5")).toBeNull();
  });
});
