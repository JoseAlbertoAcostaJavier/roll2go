import type { Ability } from "@/lib/rules/types";

/**
 * Asigna `value` a `ability`. Si otra característica ya tiene ese valor, intercambia las dos casillas
 * (la otra recibe lo que había en `ability`, que puede ser vacío).
 */
export function assignValue(
  current: Record<Ability, number | null>,
  ability: Ability,
  value: number,
): Record<Ability, number | null> {
  const next = { ...current };
  const other = (Object.keys(current) as Ability[]).find((a) => a !== ability && current[a] === value);
  if (other) next[other] = current[ability];
  next[ability] = value;
  return next;
}

export const MAX_TOTAL = 20;

/** Valor base máximo de una característica: el tope del método, sin pasar de 20 con la bonificación. */
export function maxBase(methodMax: number, bonus: number): number {
  return Math.min(methodMax, MAX_TOTAL - bonus);
}

/** `true` si base + bonificación supera 20 (casilla vacía: nunca). */
export function exceedsLimit(base: number | null, bonus: number): boolean {
  return base !== null && base + bonus > MAX_TOTAL;
}

/** Ninguna característica supera 20 en total. */
export function totalsWithinLimit(base: Record<Ability, number | null>, bonus: Partial<Record<Ability, number>>): boolean {
  return (Object.keys(base) as Ability[]).every((a) => !exceedsLimit(base[a], bonus[a] ?? 0));
}
