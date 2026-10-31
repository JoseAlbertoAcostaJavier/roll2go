// Borradores del creador (JSON en localStorage): lógica pura para limpiarlos

const EMPTY_BASE = { str: null, dex: null, con: null, int: null, wis: null, cha: null };

/**
 * El borrador sin las tiradas (y, si el método es «tiradas», sin el reparto que salía de ellas).
 * `null` si no hay nada que cambiar: JSON inválido, no es un objeto o no tenía tiradas.
 */
export function draftWithoutRolls(raw: string): string | null {
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof d !== "object" || d === null || Array.isArray(d)) return null;
  const draft = d as Record<string, unknown>;
  if (draft.rolls === null || draft.rolls === undefined) return null;
  return JSON.stringify({ ...draft, rolls: null, ...(draft.method === "roll" ? { base: { ...EMPTY_BASE } } : {}) });
}
