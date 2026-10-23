import { describe, expect, test } from "vitest";
import { booksAreValid, booksForCharacter } from "@/lib/CampaignRules";
import type { BookOption } from "@/lib/rules/books";

const book = (id: string, systemId: string): BookOption => ({
  id,
  key: id.toUpperCase(),
  systemId,
  name: id,
  license: "official",
  attribution: "",
});

const systemBooks = [book("a1", "dnd-2024"), book("a2", "dnd-2024"), book("a3", "dnd-2024")];

const rules = (over: Partial<Parameters<typeof booksForCharacter>[0]> = {}) => ({
  systemId: "dnd-2024",
  restrictBooks: false,
  allowedBooks: [] as string[],
  charactersRules: { allowed: true, internal: true, external: true },
  ...over,
});

describe("booksForCharacter", () => {
  test("sin filtro devuelve todos los libros del sistema", () => {
    expect(booksForCharacter(rules(), systemBooks).map((b) => b.id)).toEqual(["a1", "a2", "a3"]);
  });

  test("con filtro devuelve solo los ids permitidos", () => {
    const r = rules({ restrictBooks: true, allowedBooks: ["a2", "otro"] });
    expect(booksForCharacter(r, systemBooks).map((b) => b.id)).toEqual(["a2"]);
  });
});

describe("booksAreValid", () => {
  test("rechaza ids que no son del sistema", () => {
    expect(booksAreValid(rules(), "external", ["a1", "x9"], systemBooks)).toBe(false);
    expect(booksAreValid(rules(), "internal", ["x9"], systemBooks)).toBe(false);
  });

  test("externo: vale cualquier libro del sistema", () => {
    const r = rules({ restrictBooks: true, allowedBooks: ["a1"] });
    expect(booksAreValid(r, "external", ["a1", "a3"], systemBooks)).toBe(true);
  });

  test("interno sin filtro: vale cualquier libro del sistema", () => {
    expect(booksAreValid(rules(), "internal", ["a1", "a3"], systemBooks)).toBe(true);
  });

  test("interno con filtro: rechaza ids fuera de allowedBooks", () => {
    const r = rules({ restrictBooks: true, allowedBooks: ["a1"] });
    expect(booksAreValid(r, "internal", ["a1"], systemBooks)).toBe(true);
    expect(booksAreValid(r, "internal", ["a1", "a3"], systemBooks)).toBe(false);
  });
});
