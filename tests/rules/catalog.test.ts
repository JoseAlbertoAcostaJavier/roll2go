import { describe, expect, it } from "vitest";
import { pickBooks } from "@/lib/rules/pickBooks";

describe("pickBooks", () => {
  const visible = ["a", "b", "c"];

  it("una campaña que restringe ignora chosen aunque traiga libros ajenos", () => {
    const campaign = { restrictBooks: true, allowedBooks: ["a", "x"] };
    expect(pickBooks({ visible, campaign, chosen: ["b", "y"] })).toEqual(["a"]);
  });

  it("chosen con un id que no está en visible no lo añade", () => {
    expect(pickBooks({ visible, campaign: null, chosen: ["b", "ajeno"] })).toEqual(["b"]);
  });

  it("chosen sin ningún libro visible se ignora", () => {
    expect(pickBooks({ visible, campaign: null, chosen: ["ajeno", "otro"] })).toEqual(visible);
  });

  it("sin campaña ni chosen devuelve visible", () => {
    expect(pickBooks({ visible, campaign: null, chosen: [] })).toEqual(visible);
  });

  it("una campaña que no restringe deja elegir con chosen", () => {
    const campaign = { restrictBooks: false, allowedBooks: ["a"] };
    expect(pickBooks({ visible, campaign, chosen: ["c"] })).toEqual(["c"]);
  });
});
