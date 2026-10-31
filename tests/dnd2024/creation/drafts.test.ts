import { describe, expect, it } from "vitest";
import { draftWithoutRolls } from "@/lib/rules/dnd2024/creation/drafts";

const rolls = { values: [15, 14, 13, 12, 10, 8], token: "t" };

describe("draftWithoutRolls", () => {
  it("quita las tiradas y vacía el reparto cuando el método es tiradas", () => {
    const raw = JSON.stringify({ name: "Ana", method: "roll", rolls, base: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } });
    const out = JSON.parse(draftWithoutRolls(raw)!);
    expect(out.rolls).toBeNull();
    expect(out.base).toEqual({ str: null, dex: null, con: null, int: null, wis: null, cha: null });
    expect(out.name).toBe("Ana");
    expect(out.method).toBe("roll");
  });

  it("deja el reparto intacto si el método ya era otro", () => {
    const base = { str: 10, dex: 9, con: 8, int: 8, wis: 8, cha: 8 };
    const out = JSON.parse(draftWithoutRolls(JSON.stringify({ method: "pointBuy", rolls, base }))!);
    expect(out.rolls).toBeNull();
    expect(out.base).toEqual(base);
  });

  it("devuelve null si no hay tiradas que quitar", () => {
    expect(draftWithoutRolls(JSON.stringify({ method: "roll", rolls: null }))).toBeNull();
    expect(draftWithoutRolls(JSON.stringify({ method: "roll" }))).toBeNull();
    expect(draftWithoutRolls("[1]")).toBeNull();
  });

  it("devuelve null si el JSON no es válido", () => {
    expect(draftWithoutRolls("{no")).toBeNull();
  });
});
