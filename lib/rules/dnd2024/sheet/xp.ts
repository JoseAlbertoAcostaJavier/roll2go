// Experiencia necesaria para cada nivel (Manual del Jugador 2024). Módulo puro.
const XP_BY_LEVEL = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

/** Experiencia que hace falta para llegar al nivel siguiente a `level`; null en el nivel máximo o fuera de rango. */
export function xpForNextLevel(level: number): number | null {
  if (!Number.isInteger(level) || level < 1) return null;
  return XP_BY_LEVEL[level] ?? null;
}
