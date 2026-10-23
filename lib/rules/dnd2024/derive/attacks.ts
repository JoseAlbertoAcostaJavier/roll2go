// Ataques de la ficha (spec §4.2): armas equipadas y ataque sin armas. Sin bonificadores mágicos.
import { damageTypeName, masteryName, weaponPropertyName } from "@/lib/rules/dnd2024/labels";
import type { Ability, ItemData } from "@/lib/rules/types";

export type Attack = {
  name: string;
  bonus: number;
  damage: string;
  /** En español. */
  damageType: string;
  /** Propiedades del arma en español. */
  properties: string[];
  /** Nombre de la maestría si el personaje la tiene con esa arma. */
  mastery: string | null;
};

export const UNARMED_NAME = "Ataque sin armas";
const FINESSE = "F";
const VERSATILE = "V";
const RANGED_TYPE = "R";

// "1d8" + 3 → "1d8+3"; con modificador 0 solo el dado
const withMod = (dice: string, mod: number) => (mod === 0 ? dice : `${dice}${mod > 0 ? "+" : "-"}${Math.abs(mod)}`);
// Versátil a dos manos: el dado siguiente (1d8 → 1d10), como todas las armas versátiles del reglamento 2024
const versatileDie = (dice: string) => {
  const m = /^(\d+)d(\d+)$/.exec(dice);
  return m && Number(m[2]) < 12 ? `${m[1]}d${Number(m[2]) + 2}` : null;
};

/** Competencia con un arma: por su categoría (`simple`/`martial`) o por el arma concreta (nombre o clave). */
export function weaponProficient(weapon: ItemData, names: string[], proficiencies: string[]): boolean {
  const list = proficiencies.map((p) => p.toLowerCase());
  const category = weapon.weapon?.category.toLowerCase();
  return (!!category && list.includes(category)) || names.some((n) => list.includes(n.toLowerCase()));
}

export function weaponAttack(
  weapon: ItemData & { name: string },
  mods: Record<Ability, number>,
  profBonus: number,
  proficient: boolean,
  mastery: boolean,
): Attack {
  const w = weapon.weapon;
  const properties = w?.properties ?? [];
  // FUE cuerpo a cuerpo, DES a distancia; la mejor de ambas si es sutil
  const ability: Ability = properties.includes(FINESSE)
    ? (mods.dex > mods.str ? "dex" : "str")
    : weapon.type === RANGED_TYPE ? "dex" : "str";
  const mod = mods[ability];
  let damage = w?.damage ? withMod(w.damage, mod) : "";
  const twoHanded = w && properties.includes(VERSATILE) ? versatileDie(w.damage) : null;
  if (twoHanded) damage += ` / ${withMod(twoHanded, mod)} (dos manos)`;
  return {
    name: weapon.name,
    bonus: mod + (proficient ? profBonus : 0),
    damage,
    damageType: w ? damageTypeName(w.damageType) : "",
    properties: properties.map(weaponPropertyName),
    mastery: mastery && w?.mastery ? masteryName(w.mastery) : null,
  };
}

/** Sin armas: 1 + FUE contundente. Con `martialArtsDie` (Monje), ese dado y la mejor de FUE y DES. */
export function unarmedAttack(mods: Record<Ability, number>, profBonus: number, martialArtsDie: string | null): Attack {
  const mod = martialArtsDie ? Math.max(mods.str, mods.dex) : mods.str;
  return {
    name: UNARMED_NAME,
    bonus: mod + profBonus,
    damage: martialArtsDie ? withMod(martialArtsDie, mod) : String(Math.max(0, 1 + mod)),
    damageType: damageTypeName("B"),
    properties: [],
    mastery: null,
  };
}
