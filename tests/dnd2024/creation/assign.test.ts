import { describe, expect, it } from "vitest";
import { assignValue, exceedsLimit, maxBase, poolSlots, totalsWithinLimit } from "@/lib/rules/dnd2024/creation/assign";

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

describe("poolSlots", () => {
  it("una opción por tirada, también las repetidas, de mayor a menor", () => {
    const { slots } = poolSlots([15, 12, 15, 10, 8, 12], [null, null, null, null, null, null]);
    expect(slots.map((s) => s.value)).toEqual([15, 15, 12, 12, 10, 8]);
    expect(new Set(slots.map((s) => s.index)).size).toBe(6);
    expect(slots.every((s) => s.owner === null)).toBe(true);
  });

  it("cada característica ocupa una tirada distinta aunque compartan valor", () => {
    const { slots, selected } = poolSlots([15, 15, 10], [15, null, 15]);
    expect(selected[0]).not.toBeNull();
    expect(selected[2]).not.toBeNull();
    expect(selected[0]).not.toBe(selected[2]);
    expect(selected[1]).toBeNull();
    expect(slots.filter((s) => s.value === 15).map((s) => s.owner).sort()).toEqual([0, 2]);
    expect(slots.find((s) => s.value === 10)!.owner).toBeNull();
  });

  it("un valor asignado que ya no está en las tiradas no ocupa ninguna", () => {
    const { selected } = poolSlots([12, 10], [18, 12]);
    expect(selected).toEqual([null, 0]);
  });
});
