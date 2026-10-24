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

export type PoolSlot = { index: number; value: number; owner: number | null };

/**
 * Las tiradas como opciones separadas (una por dado, también las repetidas), de mayor a menor. Cada valor asignado
 * (`assigned[i]`, en el orden de las características) ocupa la primera tirada libre con ese valor: `owner` es la
 * característica que la ocupa y `selected[i]` el índice de la tirada de cada característica (o null).
 */
export function poolSlots(pool: number[], assigned: (number | null)[]): { slots: PoolSlot[]; selected: (number | null)[] } {
  const slots: PoolSlot[] = pool.map((value, index) => ({ index, value, owner: null }))
    .sort((a, b) => b.value - a.value || a.index - b.index);
  const selected = assigned.map((v, i) => {
    if (v === null) return null;
    const slot = slots.find((s) => s.value === v && s.owner === null);
    if (!slot) return null;
    slot.owner = i;
    return slot.index;
  });
  return { slots, selected };
}
