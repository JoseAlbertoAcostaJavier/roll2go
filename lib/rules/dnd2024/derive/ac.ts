// Clase de armadura (spec §4.3): la primera regla que aplique, más el escudo, con su desglose.
import type { ItemData } from "@/lib/rules/types";
import { makeBreakdown, type Breakdown, type Part } from "./breakdown";

export type ArmorData = NonNullable<ItemData["armor"]>;
/** Clases con Defensa sin armadura (nombre de la clave de la clase, sin tipo ni libro). */
export type UnarmoredClass = "barbarian" | "monk";
export const UNARMORED_CLASSES: readonly UnarmoredClass[] = ["barbarian", "monk"];

const SHIELD_BONUS = 2;
const UNARMORED_BASE = 10;

type AcInput = {
  dex: number;
  con: number;
  wis: number;
  /** Armadura de cuerpo equipada (no el escudo), con el nombre del objeto. */
  armor: (ArmorData & { name: string }) | null;
  shield: boolean;
  unarmored: UnarmoredClass[];
};

export function armorClassBreakdown(input: AcInput): Breakdown {
  const { dex, con, wis, armor, shield, unarmored } = input;
  const dexPart = (value: number, label = "Modificador de Destreza"): Part => ({ label, value });
  let parts: Part[];
  if (armor) {
    // `dexCap`: null sin límite, 0 sin DES
    parts = [{ label: `Armadura: ${armor.name}`, value: armor.ac }];
    if (armor.dexCap === null) parts.push(dexPart(dex));
    else if (armor.dexCap !== 0) parts.push(dexPart(Math.min(dex, armor.dexCap), `Modificador de Destreza (máx. ${armor.dexCap})`));
  } else {
    // Defensa sin armadura (la del Monje no admite escudo); si hay varias, la mayor (y, si empatan, la de clase)
    const options: Part[][] = [[{ label: "Sin armadura", value: UNARMORED_BASE }, dexPart(dex)]];
    if (unarmored.includes("barbarian")) options.push([
      { label: "Defensa sin armadura (Bárbaro)", value: UNARMORED_BASE }, dexPart(dex),
      { label: "Modificador de Constitución", value: con },
    ]);
    if (unarmored.includes("monk") && !shield) options.push([
      { label: "Defensa sin armadura (Monje)", value: UNARMORED_BASE }, dexPart(dex),
      { label: "Modificador de Sabiduría", value: wis },
    ]);
    const sumOf = (ps: Part[]) => ps.reduce((t, p) => t + p.value, 0);
    parts = options.reduce((best, o) => (sumOf(o) >= sumOf(best) ? o : best));
  }
  if (shield) parts.push({ label: "Escudo", value: SHIELD_BONUS });
  return makeBreakdown(parts);
}

/** Como `armorClassBreakdown`, solo el total (el nombre de la armadura no hace falta). */
export function armorClass(input: Omit<AcInput, "armor"> & { armor: (ArmorData & { name?: string }) | null }): number {
  const armor = input.armor ? { ...input.armor, name: input.armor.name ?? "" } : null;
  return armorClassBreakdown({ ...input, armor }).total;
}
