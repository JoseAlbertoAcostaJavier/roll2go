// Maestrías con armas (spec de subir de nivel §8.2): cuántas tiene el personaje, cuáles valen y cómo se muestran.
// Funciones puras: las usan el creador, la ficha y las rutas que las guardan.
import type { CatalogEntry } from "@/lib/rules/catalog";
import type { ClassData, ItemData, Ref } from "@/lib/rules/types";
import { refKey } from "./equipmentRefs";
import { masteryName } from "./labels";
import { countAt } from "./levels";
import type { Dnd2024SheetV2 } from "./sheet";
import { summarizeClasses } from "./upgrade";

const MELEE_TYPE = "M";
const CATEGORIES = ["simple", "martial"];

/** Arma cuerpo a cuerpo, sencilla o marcial, con propiedad de maestría. */
export function isMasteryWeapon(data: ItemData | undefined): boolean {
  const w = data?.weapon;
  return !!w?.mastery && data?.type === MELEE_TYPE && CATEGORIES.includes(w.category.toLowerCase());
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

/** Maestrías actuales; las hojas guardadas antes de `weaponMasteries` toman las elegidas al subir de nivel. */
export function currentMasteries(sheet: Pick<Dnd2024SheetV2, "levels"> & { weaponMasteries?: Ref[] }): Ref[] {
  return sheet.weaponMasteries
    ?? sheet.levels.flatMap((l) => l.choices.flatMap((c) => (c.type === "weaponMastery" ? c.value : [])));
}

const isRef = (v: unknown): v is Ref =>
  typeof v === "object" && v !== null && typeof (v as Ref).book === "string" && typeof (v as Ref).key === "string";

/**
 * Comprueba una lista de maestrías: exactamente `allowed` armas distintas del catálogo, cuerpo a cuerpo, sencillas o
 * marciales, con propiedad de maestría y con las que el personaje tiene competencia.
 */
export function validateMasteries(
  refs: Ref[],
  ctx: { allowed: number; entries: Map<string, CatalogEntry>; proficientWith: (item: CatalogEntry) => boolean },
): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(refs) || !refs.every(isRef)) return { ok: false, error: "Maestrías no válidas." };
  if (new Set(refs.map(refKey)).size !== refs.length) return { ok: false, error: "Hay un arma repetida." };
  if (refs.length !== ctx.allowed) return { ok: false, error: `Elige ${ctx.allowed} armas con maestría.` };
  for (const r of refs) {
    const item = r.key.startsWith("item:") ? ctx.entries.get(refKey(r)) : undefined;
    const data = item?.data as ItemData | undefined;
    if (!item || !data?.weapon) return { ok: false, error: "Arma no disponible." };
    const name = item.nameEs ?? item.name;
    if (data.type !== MELEE_TYPE) return { ok: false, error: `${name}: solo armas cuerpo a cuerpo.` };
    if (!isMasteryWeapon(data)) return { ok: false, error: `${name} no tiene propiedad de maestría.` };
    if (!ctx.proficientWith(item)) return { ok: false, error: `No tienes competencia con ${name}.` };
  }
  return { ok: true };
}
