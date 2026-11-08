// Área de efecto de un conjuro, para mostrarla con su icono debajo del alcance. Módulo puro.
export type SpellAreaShape = "sphere" | "cube" | "cone" | "cylinder" | "emanation" | "line" | "radius";

export type SpellArea = { shape: SpellAreaShape; size: string; name: string };

const NAMES: Record<SpellAreaShape, string> = {
  sphere: "esfera", cube: "cubo", cone: "cono", cylinder: "cilindro", emanation: "emanación", line: "línea", radius: "radio",
};
const SHAPE_OF_NAME = Object.fromEntries(Object.entries(NAMES).map(([shape, name]) => [name, shape])) as Record<string, SpellAreaShape>;

// «20-foot-radius sphere», «15-foot cube», «5-foot-radius, 40-foot-high cylinder» y sus variantes con referencia a la regla
const AREA_IN_TEXT = /\b(\d+)[- ]foot(?:[- ]radius)?(?:,?\s+(?:and\s+)?\d+[- ]foot[- ](?:high|tall))?\s+(?:\[ref=variantrule:|\{@variantrule\s+)?(sphere|cube|cone|cylinder|emanation)\b/i;

// «in a 30-foot radius», salvo el radio de la luz que emite algo (no es un área de efecto)
const RADIUS_IN_TEXT = /(?<!light(?:\[\/ref\])?\s+in\s+a\s+)\b(\d+)[- ]foot[- ]radius\b/i;

/** Primera área descrita en el texto en inglés del conjuro; los que apuntan a un punto solo la indican ahí. */
export function spellAreaInText(text: string): { shape: SpellAreaShape; feet: number } | null {
  const match = AREA_IN_TEXT.exec(text);
  if (match) return { shape: match[2].toLowerCase() as SpellAreaShape, feet: Number(match[1]) };
  const radius = RADIUS_IN_TEXT.exec(text);
  return radius ? { shape: "radius", feet: Number(radius[1]) } : null;
}

const metres = (feet: number) => `${String(Math.round(feet * 3) / 10).replace(".", ",")} m`;

/** Separa «Personal (cono de 4,5 metros)» en alcance y área; sin área en el texto, usa la de la descripción. */
export function spellRangeParts(range: string, fromText?: { shape: SpellAreaShape; feet: number }): { range: string; area: SpellArea | null } {
  const inRange = /^(.+?) \((\p{L}+) de ([\d,]+) (metros|kilómetros)\)$/u.exec(range);
  const shape = inRange && SHAPE_OF_NAME[inRange[2]];
  if (inRange && shape) return { range: inRange[1], area: { shape, size: `${inRange[3]} ${inRange[4] === "metros" ? "m" : "km"}`, name: NAMES[shape] } };
  return { range, area: fromText ? { shape: fromText.shape, size: metres(fromText.feet), name: NAMES[fromText.shape] } : null };
}
