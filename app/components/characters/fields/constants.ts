// Límites y opciones compartidos por los formularios de creación y edición de personajes
export type Status = "active" | "retired" | "dead" | "npc";

export const STATUSES: { id: Status; label: string; description: string }[] = [
  { id: "active", label: "En activo", description: "¡En plena forma! Aparecerás en el listado principal de personajes. ¡Todo listo para la aventura!" },
  { id: "retired", label: "Retirado", description: "Ha colgado las armas. No aparecerá en el listado principal." },
  { id: "dead", label: "Fallecido", description: "Descanse en paz. No aparecerá en el listado principal." },
  { id: "npc", label: "PNJ", description: "Personaje no jugador, para el DM. No aparecerá en el listado principal." },
];

export const LIMITS = { name: 80, alignment: 40, appearance: 500, age: 500, languages: 500, notes: 10000 };
export const MAX_XP = 355000;
export const IMAGE_MB = 2;
