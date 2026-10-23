import { describe, expect, it } from "vitest";
import { accentInsensitive } from "@/lib/utils";

describe("accentInsensitive", () => {
  const matches = (q: string, text: string) => new RegExp(accentInsensitive(q), "i").test(text);

  it("encuentra el texto con o sin tildes", () => {
    expect(matches("barbaro", "Bárbaro")).toBe(true);
    expect(matches("Bárbaro", "barbaro")).toBe(true);
    expect(matches("muñeca", "MUNECA")).toBe(true);
    expect(matches("pinguino", "Pingüino")).toBe(true);
    expect(matches("barbaro", "Bardo")).toBe(false);
  });
  it("escapa los caracteres especiales", () => {
    expect(matches("a.b", "axb")).toBe(false);
    expect(matches("(elfo)", "Drow (Elfo)")).toBe(true);
  });
});
