import type { BookOption } from "@/lib/rules/books";

type Rules = {
  systemId: string;
  restrictBooks: boolean;
  allowedBooks: string[];
  charactersRules: { allowed: boolean; internal: boolean; external: boolean };
};

// Con filtro: solo los libros aprobados por el DM. Sin filtro: todos los del sistema.
// systemBooks: libros del sistema de la campaña (los carga el llamador desde la base de datos).
export function booksForCharacter(c: Rules, systemBooks: BookOption[]) {
  if (!c.restrictBooks) return systemBooks;
  const allowed = new Set(c.allowedBooks);
  return systemBooks.filter((b) => allowed.has(b.id));
}

// "internal": creado desde la campaña. "external": creado fuera y añadido después.
export const canAddCharacter = (c: Rules, kind: "internal" | "external") =>
  c.charactersRules.allowed && c.charactersRules[kind];

// Comprueba los libros que usa un personaje: los internos solo pueden usar los de la campaña
export function booksAreValid(
  c: Rules,
  kind: "internal" | "external",
  bookIds: string[],
  systemBooks: BookOption[],
) {
  const ofSystem = new Set(systemBooks.map((b) => b.id));
  if (!bookIds.every((id) => ofSystem.has(id))) return false; // libros de otro sistema
  if (kind === "external") return true;
  const allowed = new Set(booksForCharacter(c, systemBooks).map((b) => b.id));
  return bookIds.every((id) => allowed.has(id));
}
