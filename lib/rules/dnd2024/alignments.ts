// Alineamientos de D&D 2024. En la hoja se guarda el `id`; el nombre y la descripción son para mostrar.
export type Alignment = { id: string; name: string; description: string };

export const ALIGNMENTS: Alignment[] = [
  { id: "lawful good", name: "Legal bueno", description: "Hace lo correcto, tal y como la sociedad espera de él." },
  { id: "neutral good", name: "Neutral bueno", description: "Hace el bien lo mejor que puede, sin atarse a normas." },
  { id: "chaotic good", name: "Caótico bueno", description: "Sigue su conciencia sin importarle lo que esperen los demás." },
  { id: "lawful neutral", name: "Legal neutral", description: "Actúa según la ley, la tradición o un código personal." },
  { id: "neutral", name: "Neutral", description: "Evita los dilemas morales y no toma partido." },
  { id: "chaotic neutral", name: "Caótico neutral", description: "Sigue sus caprichos y valora su libertad por encima de todo." },
  { id: "lawful evil", name: "Legal malvado", description: "Toma lo que quiere de forma metódica, dentro de unos límites." },
  { id: "neutral evil", name: "Neutral malvado", description: "Hace lo que le conviene, sin compasión ni escrúpulos." },
  { id: "chaotic evil", name: "Caótico malvado", description: "Actúa con violencia arbitraria, llevado por el odio o la sed de sangre." },
];

// Nombre para mostrar; un valor que no es de la lista se muestra tal cual
export const alignmentName = (id: string) => ALIGNMENTS.find((a) => a.id === id)?.name ?? id;
