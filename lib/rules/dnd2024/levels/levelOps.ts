// Añadir y quitar niveles de una hoja v2 (spec de subir de nivel §4.1 y §4.3). Funciones puras: las rutas guardan solo
// los campos que cambian. Las elecciones se quedan en la entrada del nivel, así que borrarlo las deshace (también los
// reemplazos de opciones: la derivación lee las elecciones de los niveles).
import type { Ref } from "@/lib/rules/types";
import type { CasterBlock, Slots } from "../derive/spells";
import { refKey } from "../sheet/equipmentRefs";
import { currentMasteries } from "./masteries";
import type { Dnd2024SheetV2, LevelEntry } from "../sheet/sheet";
import { preparedKey } from "../spells/spellcasting";
import { trimSpells } from "../spells/spellOps";
import { summarizeClasses } from "../sheet/upgrade";

const masteriesOf = (entry: LevelEntry) => entry.choices.flatMap((c) => (c.type === "weaponMastery" ? c.value : []));

/** Comprueba el `expectedLevel` del cuerpo: no entero → 400; distinto del nivel actual + 1 → 409 (el personaje cambió). */
export function checkExpectedLevel(
  expected: unknown, current: number,
): { ok: true } | { ok: false; status: 400 | 409; error: string } {
  if (!Number.isInteger(expected)) return { ok: false, status: 400, error: "Nivel esperado no válido." };
  if (expected !== current + 1)
    return { ok: false, status: 409, error: "El personaje ha cambiado de nivel; recarga la página." };
  return { ok: true };
}

/**
 * Hoja con el nivel nuevo. Los PG actuales suben con el máximo si estaban al máximo; las maestrías que elige el nivel
 * se añaden a las de la hoja (que parten de las del historial si todavía no las guardaba).
 */
export function applyLevel(
  sheet: Dnd2024SheetV2, entry: LevelEntry, maxHpBefore: number, maxHpAfter: number,
): Dnd2024SheetV2 {
  const levels = [...sheet.levels, entry];
  const current = sheet.hp.current ?? maxHpBefore;
  const next: Dnd2024SheetV2 = {
    ...sheet,
    levels,
    classesSummary: summarizeClasses(levels),
    hp: { ...sheet.hp, current: current >= maxHpBefore ? maxHpAfter : current },
  };
  const added = masteriesOf(entry);
  if (added.length) {
    const held = currentMasteries(sheet);
    const heldKeys = new Set(held.map(refKey));
    next.weaponMasteries = [...held, ...added.filter((r) => !heldKeys.has(refKey(r)))];
  }
  return next;
}

/**
 * Hoja sin el último nivel: el nivel 1 no se borra; los PG actuales se recortan al nuevo máximo. Quita las maestrías
 * que añadió el nivel; si ya se habían cambiado por otras, recorta las de la hoja a `masteriesAfter` (las que permite
 * la hoja sin el nivel, `masteryCount`). Con `spellsAfter` (bloques y espacios de la hoja sin el nivel), quita los
 * preparados que ya no caben y recorta los espacios gastados (`trimSpells`). Si el nivel daba la subclase, quita la
 * alternativa de conjuros elegida para ella (`spellOption`); sin Dominio de conjuros, los elegidos (`spellMastery`).
 */
export function removeLastLevel(
  sheet: Dnd2024SheetV2, maxHpAfter: number, masteriesAfter = Infinity,
  spellsAfter?: { blocks: CasterBlock[]; slots: Slots; spellLevel: (ref: Ref) => number | undefined },
): { ok: true; sheet: Dnd2024SheetV2 } | { ok: false; error: string } {
  if (sheet.levels.length <= 1) return { ok: false, error: "El nivel 1 no se puede borrar." };
  const removed = sheet.levels[sheet.levels.length - 1];
  const levels = sheet.levels.slice(0, -1);
  const next: Dnd2024SheetV2 = {
    ...sheet,
    levels,
    classesSummary: summarizeClasses(levels),
    hp: { ...sheet.hp, current: Math.min(sheet.hp.current ?? maxHpAfter, maxHpAfter) },
  };
  const added = masteriesOf(removed);
  if (sheet.weaponMasteries && added.length) {
    // Una sola copia por maestría añadida: si ya la tenía de antes, queda la otra
    const left = [...sheet.weaponMasteries];
    for (const r of added) {
      const i = left.findIndex((m) => refKey(m) === refKey(r));
      if (i >= 0) left.splice(i, 1);
    }
    next.weaponMasteries = left.slice(0, masteriesAfter);
  }
  if (spellsAfter) Object.assign(next, trimSpells(sheet, spellsAfter));
  // Sin Dominio de conjuros (el Mago baja de 18) se olvidan los elegidos
  if (spellsAfter && next.spellMastery && !spellsAfter.blocks.some((b) => b.mastery)) delete next.spellMastery;
  // La alternativa de conjuros elegida en la ficha para la subclase que daba el nivel
  const subclass = removed.choices.find((c) => c.type === "subclass");
  if (subclass?.type === "subclass" && sheet.spellOption) {
    const key = preparedKey(subclass.value.ref);
    next.spellOption = Object.fromEntries(Object.entries(sheet.spellOption).filter(([k]) => k !== key));
  }
  return { ok: true, sheet: next };
}
