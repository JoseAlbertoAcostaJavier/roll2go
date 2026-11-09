export type System = {
  id: string;
  name: string;
  /** Descripción breve de su tarjeta en Inicio. */
  text: string;
  creator: boolean;
  /** Ilustración de la tarjeta, sin degradado (lo aplica la tarjeta). */
  image: string;
  /** Logotipo; sin él, la tarjeta muestra `title`. */
  logo?: string;
  /** Texto principal de la tarjeta si no hay logotipo. */
  title?: string;
  /** Línea bajo el logotipo o el título: la edición. */
  edition: string;
};

export const system: System[] = [
  { id: "pf2", name: "Pathfinder 2", text: "Fantasía medieval épica donde las opciones son infinitas y tu destino está en tus manos.", creator: false, image: "/assets/systems/pathfinder2e.webp", logo: "/assets/systems/logos/PF2Logo.svg", edition: "2.ª edición" },
  { id: "dnd-2024", name: "D&D 5.5 (2024)", text: "La edición revisada de Dungeons & Dragons, ahora con nuevos hechizos y reglas mejoradas.", creator: true, image: "/assets/systems/dnd2024.webp", logo: "/assets/systems/logos/dndfull.svg", edition: "5.5 (2024)" },
  { id: "dnd-5", name: "D&D 5e (2014)", text: "Sumérgete en el mundo que cautivó a miles y revolucionó el género.", creator: false, image: "/assets/systems/dnd2014.webp", logo: "/assets/systems/logos/dndfull.svg", edition: "5e (2014)" },
  { id: "Vampiro-5", name: "Vampiro La Mascarada 5e", text: "Terror e intriga en las noches de un mundo gobernado por vampiros.", creator: false, image: "/assets/systems/vampire.webp", title: "Vampiro", edition: "La Mascarada 5e" },
  { id: "coc-7e", name: "La Llamada de Cthulhu 7e", text: "Desvela secretos prohibidos y enfréntate a los horrores cósmicos de los mitos de Lovecraft.", creator: false, image: "/assets/systems/coc7e.webp", title: "La Llamada de Cthulhu", edition: "7.ª edición" },
  { id: "dcc", name: "Daggerheart", text: "El juego de rol de los creadores de Critical Role.", creator: false, image: "/assets/systems/daggertheart.webp", title: "Daggerheart", edition: "1.ª edición" },
];

/* Disponibilidad de un sistema: solo se puede crear personaje en los que tienen creador. */
export function isSystemAvailable(s: System): boolean {
  return s.creator;
}

/* Destino de la tarjeta de un sistema en Inicio; null si aún no está disponible. */
export function systemHref(s: System): string | null {
  return isSystemAvailable(s) ? `/characters/new?system=${encodeURIComponent(s.id)}` : null;
}
