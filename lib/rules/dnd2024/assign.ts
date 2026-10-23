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
