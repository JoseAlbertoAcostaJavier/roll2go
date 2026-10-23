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
const LIGHT = "L";
const VERSATILE = "V";
const RANGED_TYPE = "R";
const MELEE_TYPE = "M";
const MARTIAL = "martial";

// Competencia por propiedad (Pícaro y Monje de 2024): «Martial weapons that have the Finesse or Light property»
const PROPERTY_PROFICIENCY = /^martial weapons that have the (.+) propert(?:y|ies)$/;
const PROPERTY_CODES: Record<string, string> = {
  ammunition: "A", finesse: FINESSE, heavy: "H", light: LIGHT, loading: "LD", reach: "R", special: "S",
  thrown: "T", "two-handed": "2H", versatile: VERSATILE,
};

// "1d8" + 3 → "1d8+3"; con modificador 0 solo el dado
const withMod = (dice: string, mod: number) => (mod === 0 ? dice : `${dice}${mod > 0 ? "+" : "-"}${Math.abs(mod)}`);
// Versátil a dos manos: el dado siguiente (1d8 → 1d10), como todas las armas versátiles del reglamento 2024
const versatileDie = (dice: string) => {
  const m = /^(\d+)d(\d+)$/.exec(dice);
  return m && Number(m[2]) < 12 ? `${m[1]}d${Number(m[2]) + 2}` : null;
};

// "1d8" → 8; null si no es un dado simple
const dieFaces = (dice: string) => {
  const m = /^\d+d(\d+)$/.exec(dice);
  return m ? Number(m[1]) : null;
};
// El dado de más caras de los dos (el del arma si no se pueden comparar)
const largerDie = (dice: string, other: string) => ((dieFaces(other) ?? 0) > (dieFaces(dice) ?? Infinity) ? other : dice);

/** Competencia con un arma: por su categoría (`simple`/`martial`), por el arma concreta (nombre o clave) o, en las
 *  marciales, por tener alguna de las propiedades que nombra la competencia. */
export function weaponProficient(weapon: ItemData, names: string[], proficiencies: string[]): boolean {
  const list = proficiencies.map((p) => p.trim().toLowerCase());
  const category = weapon.weapon?.category.toLowerCase();
  if ((!!category && list.includes(category)) || names.some((n) => list.includes(n.toLowerCase()))) return true;
  if (category !== MARTIAL) return false;
  const properties = weapon.weapon?.properties ?? [];
  return list.some((p) => {
    const m = PROPERTY_PROFICIENCY.exec(p);
    if (!m) return false;
    const wanted = m[1].split(/,|\bor\b|\band\b/).map((n) => PROPERTY_CODES[n.trim()]).filter(Boolean);
    return wanted.some((code) => properties.includes(code));
  });
}

/** Arma de monje: cuerpo a cuerpo y sencilla, o marcial con la propiedad Ligera. */
export function isMonkWeapon(weapon: ItemData): boolean {
  const w = weapon.weapon;
  if (!w || weapon.type !== MELEE_TYPE) return false;
  const category = w.category.toLowerCase();
  return category === "simple" || (category === MARTIAL && w.properties.includes(LIGHT));
}

export function weaponAttack(
  weapon: ItemData & { name: string },
  mods: Record<Ability, number>,
  profBonus: number,
  proficient: boolean,
  mastery: boolean,
  martialArtsDie: string | null = null,
): Attack {
  const w = weapon.weapon;
  const properties = w?.properties ?? [];
  // Artes marciales del Monje con un arma de monje: la mejor de FUE y DES y el dado mayor
  const martialArts = martialArtsDie && isMonkWeapon(weapon) ? martialArtsDie : null;
  // FUE cuerpo a cuerpo, DES a distancia; la mejor de ambas si es sutil
  const ability: Ability = properties.includes(FINESSE) || martialArts
    ? (mods.dex > mods.str ? "dex" : "str")
    : weapon.type === RANGED_TYPE ? "dex" : "str";
  const mod = mods[ability];
  const die = (dice: string) => (martialArts ? largerDie(dice, martialArts) : dice);
  let damage = w?.damage ? withMod(die(w.damage), mod) : "";
  const twoHanded = w && properties.includes(VERSATILE) ? versatileDie(w.damage) : null;
  if (twoHanded) damage += ` / ${withMod(die(twoHanded), mod)} (dos manos)`;
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
