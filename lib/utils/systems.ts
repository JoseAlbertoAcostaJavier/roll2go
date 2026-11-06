export type System = { id: string; name: string; text: string; creator: boolean };

export const system: System[] = [
  { id: "pf2", name: "Pathfinder 2", text: "Un viaje épico de fantasía medieval donde las opciones son infinitas y tu destino está en tus manos.", creator: false },
  { id: "dnd-2024", name: "D&D 5.5 (2024)", text: "Edición revisada de Dungeons & Dragons, ahora con nuevos hechizos, y reglas mejoradas para propulsar tu aventura a nuevos horizontes", creator: true },
  { id: "dnd-5", name: "D&D 5e (2014)", text: "Sumérgete en el mundo que cautivó a miles y revolucionó el género.", creator: false },
  { id: "Vampiro-5", name: "Vampiro La Mascarada 5e", text: "Adentrate en un universo basado en el terror y la intriga durante la noche con Vampiro 5e.", creator: false },
  { id: "coc-7e", name: "La Llamada de Cthulhu 7e", text: "Desvela secretos prohibidos y enfréntate a los horrores cósmicos de los mitos de Lovecraft en La Llamada de Cthulhy 7e.", creator: false },
  { id: "dcc", name: "Daggerheart", text: "De los creadores de Critical Role, llega su propio Juego de Rol para desafíar a DnD.", creator: false },
];

/* Disponibilidad de un sistema: solo se puede crear personaje en los que tienen creador. */
export function isSystemAvailable(s: System): boolean {
  return s.creator;
}

/* Destino de la tarjeta de un sistema en Inicio; null si aún no está disponible. */
export function systemHref(s: System): string | null {
  return isSystemAvailable(s) ? `/characters/new?system=${encodeURIComponent(s.id)}` : null;
}
