import { CORE_BOOK_KEY } from "@/lib/rules/catalog/pickBooks";
import type { BookOption } from "@/lib/rules/catalog/types";

type Rules = {
  systemId: string;
  restrictBooks: boolean;
  allowedBooks: string[];
  charactersRules: { allowed: boolean; internal: boolean; external: boolean };
};

// Con filtro: los libros aprobados por el DM y las reglas básicas. Sin filtro: todos los del sistema.
// systemBooks: libros del sistema de la campaña (los carga el llamador desde la base de datos).
export function booksForCharacter(c: Rules, systemBooks: BookOption[]) {
  if (!c.restrictBooks) return systemBooks;
  const allowed = new Set(c.allowedBooks);
  return systemBooks.filter((b) => allowed.has(b.id) || b.key === CORE_BOOK_KEY);
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

type JoinInput = {
  campaign: {
    systemId: string;
    status: string;
    characters: { allowed: boolean; external: boolean };
    restrictBooks: boolean;
    allowedBooks: string[];
  };
  // books: los libros que usa de verdad su hoja (booksUsedBy), no Character.books
  character: { systemId: string; campaign: string | null; books: string[] };
  isMember: boolean;
  /** Ids de las reglas básicas: siempre permitidas. */
  coreBooks?: string[];
};

// Si un personaje creado fuera puede solicitar unirse a la campaña. Con libros no permitidos devuelve sus ids en
// `disallowed` (la ruta añade sus nombres al mensaje).
export function canRequestJoin(
  input: JoinInput,
): { ok: true } | { ok: false; error: string; disallowed?: string[] } {
  const { campaign, character } = input;
  if (!input.isMember) return { ok: false, error: "No eres miembro de esta campaña." };
  if (campaign.status !== "active") return { ok: false, error: "Esta campaña no está activa." };
  if (campaign.systemId !== character.systemId) return { ok: false, error: "La campaña es de otro sistema de juego." };
  if (!campaign.characters.allowed || !campaign.characters.external)
    return { ok: false, error: "Esta campaña no admite personajes creados fuera de ella." };
  if (character.campaign) return { ok: false, error: "Este personaje ya está en una campaña." };
  if (campaign.restrictBooks) {
    const allowed = new Set([...campaign.allowedBooks, ...(input.coreBooks ?? [])]);
    const disallowed = character.books.filter((b) => !allowed.has(b));
    if (disallowed.length) return { ok: false, error: "Este personaje usa libros que la campaña no permite.", disallowed };
  }
  return { ok: true };
}
