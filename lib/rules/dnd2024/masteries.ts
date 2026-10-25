// Maestrías con armas (spec de subir de nivel §8.2): cuántas tiene el personaje, cuáles valen y cómo se muestran.
// Funciones puras: las usan el creador, la ficha y las rutas que las guardan.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { ClassData, ItemData, Ref } from "@/lib/rules/types";
import { isRef, refKey } from "./equipmentRefs";
import { masteryName } from "./labels";
import { countAt } from "./levels";
import type { Dnd2024SheetV2 } from "./sheet";
import { summarizeClasses } from "./upgrade";

const MELEE_TYPE = "M";
// Cuerpo a cuerpo y a distancia: un foco (el Bastón arcano) puede traer datos de arma sin serlo
const WEAPON_TYPES = [MELEE_TYPE, "R"];
const CATEGORIES = ["simple", "martial"];
const MASTERY_SOURCE = "progression:weapon mastery|";
// "class:barbarian|xphb" → "barbarian|xphb"
const bareKey = (key: string) => key.replace(/^[^:]*:/, "");

/** Clases (`nombre|fuente`) cuyas maestrías solo pueden ser de armas cuerpo a cuerpo; las demás, de cualquier arma. */
export const MELEE_ONLY_MASTERY: ReadonlySet<string> = new Set(["barbarian|xphb"]);

/** Si la elección `weaponMastery` con este `source` («progression:weapon mastery|barbarian|xphb») es solo cuerpo a cuerpo. */
export const meleeOnlySource = (source: string) =>
  source.startsWith(MASTERY_SOURCE) && MELEE_ONLY_MASTERY.has(source.slice(MASTERY_SOURCE.length));

/**
 * Arma base (sin rareza: no un arma mágica) sencilla o marcial con propiedad de maestría (con `meleeOnly`, además
 * cuerpo a cuerpo).
 */
export function isMasteryWeapon(data: ItemData | undefined, meleeOnly = false): boolean {
  const w = data?.weapon;
  return !!w?.mastery && CATEGORIES.includes(w.category.toLowerCase()) && !data?.rarity
    && WEAPON_TYPES.includes(data?.type ?? "") && (!meleeOnly || data?.type === MELEE_TYPE);
}

/** «Espada corta (Vejar)». */
export const masteryLabel = (name: string, mastery: string | undefined) =>
  mastery ? `${name} (${masteryName(mastery)})` : name;

/** Número de maestrías: la progresión de cada clase a su nivel actual, sumadas. */
export function masteryCount(sheet: Pick<Dnd2024SheetV2, "levels">, entries: Map<string, CatalogEntry>): number {
  return summarizeClasses(sheet.levels).reduce((total, c) => {
    const data = entries.get(refKey(c.class.ref))?.data as ClassData | undefined;
    return total + countAt(data?.progressions?.weaponMastery, c.level);
  }, 0);
}

/**
 * Si las maestrías de la hoja solo pueden ser cuerpo a cuerpo: cuando todas las clases que las dan lo exigen (un
 * Bárbaro que entra en Guerrero ya puede elegir armas a distancia).
 */
export function masteryMeleeOnly(sheet: Pick<Dnd2024SheetV2, "levels">, entries: Map<string, CatalogEntry>): boolean {
  const granting = summarizeClasses(sheet.levels).filter((c) => {
    const data = entries.get(refKey(c.class.ref))?.data as ClassData | undefined;
    return countAt(data?.progressions?.weaponMastery, c.level) > 0;
  });
  return granting.length > 0 && granting.every((c) => MELEE_ONLY_MASTERY.has(bareKey(c.class.ref.key)));
}

/** Maestrías actuales; las hojas guardadas antes de `weaponMasteries` toman las elegidas al subir de nivel. */
export function currentMasteries(sheet: Pick<Dnd2024SheetV2, "levels"> & { weaponMasteries?: Ref[] }): Ref[] {
  return sheet.weaponMasteries
    ?? sheet.levels.flatMap((l) => l.choices.flatMap((c) => (c.type === "weaponMastery" ? c.value : [])));
}

/**
 * Comprueba una lista de maestrías: exactamente `allowed` armas distintas del catálogo, sencillas o marciales, con
 * propiedad de maestría y con las que el personaje tiene competencia; con `meleeOnly` (Bárbaro), cuerpo a cuerpo.
 */
export function validateMasteries(
  refs: Ref[],
  ctx: {
    allowed: number;
    entries: Map<string, CatalogEntry>;
    proficientWith: (item: CatalogEntry) => boolean;
    meleeOnly?: boolean;
  },
): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(refs) || !refs.every(isRef)) return { ok: false, error: "Maestrías no válidas." };
  if (new Set(refs.map(refKey)).size !== refs.length) return { ok: false, error: "Hay un arma repetida." };
  if (refs.length !== ctx.allowed) return { ok: false, error: `Elige ${ctx.allowed} armas con maestría.` };
  for (const r of refs) {
    const item = r.key.startsWith("item:") ? ctx.entries.get(refKey(r)) : undefined;
    const data = item?.data as ItemData | undefined;
    if (!item || !data?.weapon) return { ok: false, error: "Arma no disponible." };
    const name = item.nameEs ?? item.name;
    if (ctx.meleeOnly && data.type !== MELEE_TYPE) return { ok: false, error: `${name}: solo armas cuerpo a cuerpo.` };
    if (!isMasteryWeapon(data)) return { ok: false, error: `${name} no tiene propiedad de maestría.` };
    if (!ctx.proficientWith(item)) return { ok: false, error: `No tienes competencia con ${name}.` };
  }
  return { ok: true };
}
