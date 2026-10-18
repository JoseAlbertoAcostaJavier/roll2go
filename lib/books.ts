export type Book = { id: string; systemId: string; name: string };

/* Catálogo de libros por sistema. Los systemId tienen que coincidir con los "id" de lib/systems.ts.
   Ejemplo con los manuales básicos: añade aquí el resto (y los de los demás sistemas). */
export const books: Book[] = [
  { id: "dnd-5-phb", systemId: "dnd-5", name: "Manual del Jugador" },
  { id: "dnd-5-dmg", systemId: "dnd-5", name: "Guía del Dungeon Master" },
  { id: "dnd-5-mm", systemId: "dnd-5", name: "Manual de Monstruos" },
  {
    id: "dnd-2024-phb",
    systemId: "dnd-2024",
    name: "Manual del Jugador (2024)",
  },
  {
    id: "dnd-2024-dmg",
    systemId: "dnd-2024",
    name: "Guía del Dungeon Master (2024)",
  },
  {
    id: "dnd-2024-mm",
    systemId: "dnd-2024",
    name: "Manual de Monstruos (2024)",
  },
];

export const booksOf = (systemId: string) =>
  books.filter((b) => b.systemId === systemId);
