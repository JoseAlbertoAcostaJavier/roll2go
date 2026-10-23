import { describe, expect, it } from "vitest";
import { assignValue, exceedsLimit, maxBase, totalsWithinLimit } from "@/lib/rules/dnd2024/assign";

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

describe("tope de 20", () => {
  it("manual 20 con +2 queda bloqueado", () => {
    expect(maxBase(20, 2)).toBe(18);
    expect(maxBase(20, 0)).toBe(20);
    expect(maxBase(15, 2)).toBe(15);
  });
  it("tirada 18 con +2 se marca; 19 con +1 se permite", () => {
    expect(exceedsLimit(18, 3)).toBe(true);
    expect(exceedsLimit(19, 1)).toBe(false);
    expect(exceedsLimit(null, 2)).toBe(false);
    expect(totalsWithinLimit({ ...empty, str: 19 }, { str: 1 })).toBe(true);
    expect(totalsWithinLimit({ ...empty, str: 19 }, { str: 2 })).toBe(false);
  });
});
