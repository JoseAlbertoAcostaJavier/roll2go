// Clase de armadura (spec §4.3): la primera regla que aplique, más el escudo.
import type { ItemData } from "@/lib/rules/types";

export type ArmorData = NonNullable<ItemData["armor"]>;
/** Clases con Defensa sin armadura (nombre de la clave de la clase, sin tipo ni libro). */
export type UnarmoredClass = "barbarian" | "monk";
export const UNARMORED_CLASSES: readonly UnarmoredClass[] = ["barbarian", "monk"];

const SHIELD_BONUS = 2;

export function armorClass(input: {
  dex: number;
  con: number;
  wis: number;
  /** Armadura de cuerpo equipada (no el escudo). */
  armor: ArmorData | null;
  shield: boolean;
  unarmored: UnarmoredClass[];
}): number {
  const { dex, con, wis, armor, shield, unarmored } = input;
  let base: number;
  if (armor) {
    // `dexCap`: null sin límite, 0 sin DES
    base = armor.ac + (armor.dexCap === null ? dex : armor.dexCap === 0 ? 0 : Math.min(dex, armor.dexCap));
  } else {
    // Defensa sin armadura (la del Monje no admite escudo); si hay varias, la mayor
    const options = [10 + dex];
    if (unarmored.includes("barbarian")) options.push(10 + dex + con);
    if (unarmored.includes("monk") && !shield) options.push(10 + dex + wis);
    base = Math.max(...options);
  }
  return base + (shield ? SHIELD_BONUS : 0);
}
