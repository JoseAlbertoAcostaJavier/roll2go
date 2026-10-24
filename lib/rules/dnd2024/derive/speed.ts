// Velocidad en pies con su desglose: la de la especie o el legado y los bonificadores de clase y dotes.
import { makeBreakdown, type Breakdown, type Part } from "./breakdown";

// La dote Veloz, el Movimiento rápido del Bárbaro (sin armadura pesada) y el Movimiento sin armadura del Monje (sin
// armadura ni escudo)
const SPEEDY_BONUS = 10;
const FAST_MOVEMENT_LEVEL = 5;
const FAST_MOVEMENT_BONUS = 10;
const UNARMORED_MOVEMENT_LEVEL = 2;
// Progresión del Manual si el catálogo no trae la tabla de clase: 2–5 → 10, 6–9 → 15… 18–20 → 30
const unarmoredMovementFallback = (level: number) => 10 + 5 * Math.floor((level - 2) / 4);

/** Velocidad en pies: la de la especie o el legado y los bonificadores de clase y dotes. */
export function speedBreakdown(input: {
  base: number;
  baseLabel: string;
  barbarianLevel: number;
  monkLevel: number;
  /** Valor de la columna «Movimiento sin armadura» de la tabla del Monje a su nivel («+15 pies»), si existe. */
  monkColumn: string | null;
  heavyArmor: boolean;
  anyArmor: boolean;
  shield: boolean;
  speedy: boolean;
}): Breakdown {
  const parts: Part[] = [{ label: input.baseLabel, value: input.base }];
  if (input.barbarianLevel >= FAST_MOVEMENT_LEVEL && !input.heavyArmor) {
    parts.push({ label: "Movimiento rápido", value: FAST_MOVEMENT_BONUS });
  }
  if (input.monkLevel >= UNARMORED_MOVEMENT_LEVEL && !input.anyArmor && !input.shield) {
    const feet = input.monkColumn?.match(/\d+/);
    parts.push({
      label: "Movimiento sin armadura", value: feet ? Number(feet[0]) : unarmoredMovementFallback(input.monkLevel),
    });
  }
  if (input.speedy) parts.push({ label: "Dote: Veloz", value: SPEEDY_BONUS });
  return makeBreakdown(parts);
}
