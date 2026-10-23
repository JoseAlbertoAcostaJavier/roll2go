import { describe, expect, it } from "vitest";
import { assignValue } from "@/lib/rules/dnd2024/assign";

const empty = { str: null, dex: null, con: null, int: null, wis: null, cha: null };

describe("assignValue", () => {
  it("intercambia si el valor ya está en otra característica", () => {
    const r = assignValue({ ...empty, str: 14, dex: 15 }, "str", 15);
    expect(r.str).toBe(15);
    expect(r.dex).toBe(14);
  });
  it("en una casilla vacía no toca las demás", () => {
    const start = { ...empty, dex: 15 };
    const r = assignValue(start, "con", 13);
    expect(r).toEqual({ ...start, con: 13 });
    expect(start.con).toBeNull();
  });
  it("si la casilla de destino estaba vacía, la otra queda vacía", () => {
    const r = assignValue({ ...empty, dex: 15 }, "str", 15);
    expect(r.str).toBe(15);
    expect(r.dex).toBeNull();
  });
});
