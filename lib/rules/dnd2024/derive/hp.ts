// Puntos de golpe de la hoja v2: los PG guardados de cada nivel + CON por nivel + bonificaciones.
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";

// PG extra por nivel de personaje: Dureza enana (especie) y la dote Duro (claves sin libro)
const HP_PER_LEVEL: Record<string, number> = { "species:dwarf|xphb": 1, "feat:tough|xphb": 2 };

/** `featKeys`: claves de todas las dotes del personaje (la de origen y las de nivel). */
export function hitPoints(sheet: Dnd2024SheetV2, conMod: number, featKeys: string[]): {
  max: number; current: number; temp: number;
} {
  const level = sheet.levels.length;
  const perLevel = (HP_PER_LEVEL[sheet.species.ref.key] ?? 0) + featKeys.reduce((s, k) => s + (HP_PER_LEVEL[k] ?? 0), 0);
  const rolled = sheet.levels.reduce((sum, l) => sum + l.hp.value, 0);
  const max = Math.max(0, rolled + (conMod + perLevel) * level);
  return { max, current: sheet.hp?.current ?? max, temp: sheet.hp?.temp ?? 0 };
}
