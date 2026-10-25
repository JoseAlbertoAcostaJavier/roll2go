import { describe, expect, test } from "vitest";
import { booksAreValid, booksForCharacter, canRequestJoin } from "@/lib/rules/campaignRules";
import type { BookOption } from "@/lib/rules/catalog/types";

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

describe("canRequestJoin", () => {
  type Input = Parameters<typeof canRequestJoin>[0];
  const input = (over: { campaign?: Partial<Input["campaign"]>; character?: Partial<Input["character"]>; isMember?: boolean } = {}): Input => ({
    campaign: {
      systemId: "dnd-2024",
      status: "active",
      characters: { allowed: true, external: true },
      restrictBooks: false,
      allowedBooks: [],
      ...over.campaign,
    },
    character: { systemId: "dnd-2024", campaign: null, books: ["a1", "a2"], ...over.character },
    isMember: over.isMember ?? true,
  });
  const fails = (i: Input, error: string) => expect(canRequestJoin(i)).toEqual({ ok: false, error });

  test("válida", () => {
    expect(canRequestJoin(input())).toEqual({ ok: true });
  });

  test("no miembro", () => fails(input({ isMember: false }), "No eres miembro de esta campaña."));

  test("campaña no activa", () => fails(input({ campaign: { status: "inactive" } }), "Esta campaña no está activa."));

  test("otro sistema", () =>
    fails(input({ character: { systemId: "dnd-2014" } }), "La campaña es de otro sistema de juego."));

  test("no admite personajes externos", () => {
    const error = "Esta campaña no admite personajes creados fuera de ella.";
    fails(input({ campaign: { characters: { allowed: false, external: true } } }), error);
    fails(input({ campaign: { characters: { allowed: true, external: false } } }), error);
  });

  test("ya está en una campaña", () =>
    fails(input({ character: { campaign: "c9" } }), "Este personaje ya está en una campaña."));

  test("libros no permitidos: devuelve sus ids", () => {
    expect(canRequestJoin(input({ campaign: { restrictBooks: true, allowedBooks: ["a1"] }, character: { books: ["a1", "a2", "a3"] } })))
      .toEqual({ ok: false, error: "Este personaje usa libros que la campaña no permite.", disallowed: ["a2", "a3"] });
  });

  test("libros permitidos con filtro", () => {
    expect(canRequestJoin(input({ campaign: { restrictBooks: true, allowedBooks: ["a1", "a2"] } }))).toEqual({ ok: true });
  });

  test("sin filtro de libros, los libros no importan", () => {
    expect(canRequestJoin(input({ campaign: { allowedBooks: ["a1"] }, character: { books: ["x9"] } }))).toEqual({ ok: true });
  });
});
