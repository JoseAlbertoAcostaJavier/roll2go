// Desglose de un valor derivado (de dónde sale cada número de la ficha). Invariante: `total` es la suma de las
// partes; un tope se expresa como una parte negativa («Máximo 20»).

export type Part = { label: string; value: number };
export type Breakdown = { parts: Part[]; total: number; notes?: string[] };

export function makeBreakdown(parts: Part[], notes?: string[]): Breakdown {
  const total = parts.reduce((t, p) => t + p.value, 0);
  return notes?.length ? { parts, total, notes } : { parts, total };
}
