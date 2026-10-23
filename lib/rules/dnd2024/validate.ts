// Validación en el servidor de la hoja de personaje. Los nombres salen del catálogo, nunca del cliente.
import { cleanText } from "@/lib/utils";
import type { CatalogEntry } from "@/lib/rules/catalog";
import {
  ABILITIES, type Ability, type BackgroundData, type ClassData, type Ref, type SpeciesData, type SubclassData,
} from "@/lib/rules/types";
import { POINT_BUY_TOTAL, STANDARD_ARRAY, checkBackgroundBonus, pointBuyCost } from "./abilities";
import { verifyRolls } from "./rolls";
import { ABILITY_METHODS, type AbilityMethod, type Dnd2024Sheet, type Named } from "./sheet";

export type ValidateCtx = {
  userId: string;
  books: string[];
  resolve: (ref: Ref) => Promise<CatalogEntry | null>;
  /** Si la especie tiene algún legado en los libros utilizables (si no hay ninguno, no se exige elegirlo). */
  hasLineages: (species: Ref) => Promise<boolean>;
};
export type ValidateResult = { ok: true; sheet: Dnd2024Sheet } | { ok: false; errors: Record<string, string> };

const TEXT_LIMITS = { alignment: 40, appearance: 500, age: 500, languages: 500, notes: 10000 } as const;
const MAX_XP = 355000;
type Size = "S" | "M" | "L";
const SIZES: Size[] = ["S", "M", "L"];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const sameValues = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);
const isStringList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === "string") && new Set(v).size === v.length;

export async function validateSheet(input: unknown, ctx: ValidateCtx): Promise<ValidateResult> {
  const errors: Record<string, string> = {};
  const err = (path: string, msg: string) => {
    if (!errors[path]) errors[path] = msg;
  };
  if (!isObj(input)) return { ok: false, errors: { sheet: "Hoja de personaje no válida." } };

  // Resuelve una referencia del cliente: forma, tipo (prefijo de la clave), libro permitido y existencia
  async function load(path: string, raw: unknown, kind: string): Promise<CatalogEntry | null> {
    if (!isObj(raw) || !isObj(raw.ref) || typeof raw.ref.book !== "string" || typeof raw.ref.key !== "string") {
      err(path, "Elige una opción.");
      return null;
    }
    const ref: Ref = { book: raw.ref.book, key: raw.ref.key };
    if (!ref.key.startsWith(`${kind}:`) || !ctx.books.includes(ref.book)) {
      err(path, "Contenido no disponible.");
      return null;
    }
    const entry = await ctx.resolve(ref);
    if (!entry) err(path, "Contenido no disponible.");
    return entry;
  }
  const named = (e: CatalogEntry): Named => ({ ref: { book: e.ref.book, key: e.ref.key }, name: e.nameEs || e.name });
  const isChildOf = (child: CatalogEntry, parent: CatalogEntry) =>
    !!child.parent && child.parent.key === parent.ref.key && child.parent.book === parent.ref.book;

  // Especie y legado
  const speciesEntry = await load("species", input.species, "species");
  const species = speciesEntry ? (speciesEntry.data as SpeciesData) : null;
  let lineage: Named | null = null;
  if (species && speciesEntry) {
    if (input.lineage == null) {
      if (species.hasLineages && (await ctx.hasLineages(speciesEntry.ref))) err("lineage", "Elige un legado.");
    } else if (!species.hasLineages) {
      err("lineage", "Esta especie no tiene legados.");
    } else {
      const l = await load("lineage", input.lineage, "lineage");
      if (l) {
        if (!isChildOf(l, speciesEntry)) err("lineage", "El legado no pertenece a la especie elegida.");
        else lineage = named(l);
      }
    }
  }

  // Elecciones de especie: habilidades y tamaño
  const sc = isObj(input.speciesChoices) ? input.speciesChoices : {};
  let speciesSkills: string[] = [];
  let size: Size | null = null;
  if (species) {
    const skills = sc.skills ?? [];
    const choose = species.skills.choose;
    if (!isStringList(skills)) err("speciesChoices.skills", "Habilidades de especie no válidas.");
    else if (choose) {
      if (skills.length !== choose.count || !skills.every((s) => choose.from.includes(s)))
        err("speciesChoices.skills", `Elige ${choose.count} habilidad(es) de la lista de la especie.`);
      else speciesSkills = skills;
    } else if (skills.length) err("speciesChoices.skills", "Esta especie no permite elegir habilidades.");

    const rawSize = sc.size ?? null;
    if (rawSize !== null && !SIZES.includes(rawSize as Size)) err("speciesChoices.size", "Tamaño no válido.");
    else if (species.size.length > 1 && (rawSize === null || !species.size.includes(rawSize as Size)))
      err("speciesChoices.size", "Elige un tamaño.");
    else if (rawSize !== null && !species.size.includes(rawSize as Size))
      err("speciesChoices.size", "Tamaño no válido para la especie.");
    else size = rawSize as Size | null;
  }

  // Trasfondo
  const bgEntry = await load("background", input.background, "background");
  const bg = bgEntry ? (bgEntry.data as BackgroundData) : null;
  const bonus: Partial<Record<Ability, 1 | 2>> = {};
  let bgEquipment = "";
  if (bg && isObj(input.background)) {
    const rawBonus = isObj(input.background.abilities) ? input.background.abilities : null;
    if (!rawBonus) err("background.abilities", "Reparte la bonificación del trasfondo.");
    else {
      const parsed: Partial<Record<Ability, number>> = {};
      let valid = true;
      for (const [k, v] of Object.entries(rawBonus)) {
        if (!ABILITIES.includes(k as Ability) || (v !== 0 && v !== 1 && v !== 2)) valid = false;
        else if (v) parsed[k as Ability] = v;
      }
      if (!valid || !checkBackgroundBonus(parsed, bg.abilities))
        err("background.abilities", "Reparte +2/+1 o +1/+1/+1 entre las características del trasfondo.");
      else Object.assign(bonus, parsed);
    }
    const eq = input.background.equipment;
    if (typeof eq !== "string" || !has(bg.equipment, eq)) err("background.equipment", "Elige el equipo del trasfondo.");
    else bgEquipment = eq;
  }

  // Habilidades que ya dan el trasfondo y la especie: las elegidas no pueden repetirlas
  const fixedSkills = [...(bg?.skills ?? []), ...(species?.skills.fixed ?? [])];
  if (speciesSkills.some((s) => fixedSkills.includes(s)))
    err("speciesChoices.skills", "Una habilidad de especie repite una del trasfondo.");
  const takenSkills = [...fixedSkills, ...speciesSkills];

  // Clase (por ahora, una sola clase de nivel 1)
  const classes: Dnd2024Sheet["classes"] = [];
  if (!Array.isArray(input.classes) || input.classes.length !== 1) err("classes", "Elige una clase.");
  else {
    const raw: unknown = input.classes[0];
    const cEntry = await load("classes.0", raw, "class");
    if (cEntry && isObj(raw)) {
      const cls = cEntry.data as ClassData;
      let ok = true;
      if (raw.level !== 1) {
        err("classes.0.level", "El nivel inicial es 1.");
        ok = false;
      }
      let subclass: Named | null = null;
      if (raw.subclass != null) {
        const sEntry = await load("classes.0.subclass", raw.subclass, "subclass");
        if (sEntry && !(sEntry.data as SubclassData | null)) err("classes.0.subclass", "Subclase no válida.");
        else if (sEntry && !isChildOf(sEntry, cEntry))
          err("classes.0.subclass", "La subclase no pertenece a la clase elegida.");
        else if (sEntry && cls.subclassLevel > 1) err("classes.0.subclass", "Aún no se puede elegir subclase.");
        else if (sEntry) subclass = named(sEntry);
        if (!subclass) ok = false;
      }
      const skills = raw.skills;
      if (!isStringList(skills)) err("classes.0.skills", "Habilidades de clase no válidas.");
      else if (skills.length !== cls.skills.count)
        err("classes.0.skills", `Elige exactamente ${cls.skills.count} habilidades de clase.`);
      else if (!skills.every((s) => cls.skills.from.includes(s)))
        err("classes.0.skills", "Alguna habilidad no está en la lista de la clase.");
      else if (skills.some((s) => takenSkills.includes(s)))
        err("classes.0.skills", "Una habilidad de clase repite una del trasfondo o de la especie.");
      const eq = raw.equipment;
      if (typeof eq !== "string" || !has(cls.equipment, eq)) err("classes.0.equipment", "Elige el equipo de la clase.");
      if (ok && !errors["classes.0.skills"] && !errors["classes.0.equipment"])
        classes.push({ ...named(cEntry), level: 1, subclass, skills: skills as string[], equipment: eq as string });
    }
  }

  // Características base según el método
  const method = input.abilityMethod as AbilityMethod;
  const rawBase = isObj(input.baseAbilities) ? input.baseAbilities : null;
  const base = {} as Record<Ability, number>;
  let rolls: Dnd2024Sheet["rolls"] = null;
  if (!ABILITY_METHODS.includes(method)) err("abilityMethod", "Método de características no válido.");
  else if (!rawBase || !ABILITIES.every((a) => isInt(rawBase[a]))) err("baseAbilities", "Faltan características.");
  else {
    for (const a of ABILITIES) base[a] = rawBase[a] as number;
    const vals = ABILITIES.map((a) => base[a]);
    if (method === "pointBuy") {
      if (vals.some((v) => v < 8 || v > 15)) err("baseAbilities", "Cada característica debe estar entre 8 y 15.");
      else if (pointBuyCost(base) > POINT_BUY_TOTAL) err("baseAbilities", `Te pasas de los ${POINT_BUY_TOTAL} puntos.`);
    } else if (method === "standard") {
      if (!sameValues(vals, STANDARD_ARRAY)) err("baseAbilities", "Usa exactamente los valores 15, 14, 13, 12, 10 y 8.");
    } else if (method === "manual") {
      if (vals.some((v) => v < 3 || v > 20)) err("baseAbilities", "Cada característica debe estar entre 3 y 20.");
    } else {
      const r = input.rolls;
      if (!isObj(r) || !Array.isArray(r.values) || !r.values.every(isInt) || typeof r.token !== "string")
        err("rolls", "Haz las tiradas de característica.");
      else if (!verifyRolls(ctx.userId, r.values, r.token)) err("rolls", "Las tiradas no son válidas o han caducado.");
      else if (!sameValues(vals, r.values)) err("baseAbilities", "Debes repartir exactamente las tiradas obtenidas.");
      else rolls = { values: r.values, token: r.token };
    }
    if (!errors.baseAbilities && ABILITIES.some((a) => base[a] + (bonus[a] ?? 0) > 20))
      err("background.abilities", "Ninguna característica puede superar 20.");
  }

  // Textos y números
  const text = {} as Record<keyof typeof TEXT_LIMITS, string>;
  for (const [k, max] of Object.entries(TEXT_LIMITS) as [keyof typeof TEXT_LIMITS, number][]) {
    const v = input[k] ?? "";
    if (typeof v !== "string") err(k, "Texto no válido.");
    else if (v.length > max) err(k, `Máximo ${max} caracteres.`);
    else text[k] = cleanText(v).trim();
  }
  const xp = input.xp ?? 0;
  if (!isInt(xp) || xp < 0 || xp > MAX_XP) err("xp", `Los puntos de experiencia van de 0 a ${MAX_XP}.`);

  // Al crear, los PG se calculan (derive); los valores propios llegarán con la edición de la ficha
  const rawHp = input.hp ?? { max: null, current: null, temp: 0 };
  if (!isObj(rawHp) || rawHp.max !== null || rawHp.current !== null || rawHp.temp !== 0 || Object.keys(rawHp).length !== 3)
    err("hp", "Puntos de golpe no válidos.");

  if (Object.keys(errors).length) return { ok: false, errors };
  if (!speciesEntry || !bgEntry || classes.length !== 1)
    return { ok: false, errors: { sheet: "Hoja de personaje no válida." } };

  return {
    ok: true,
    sheet: {
      version: 1,
      species: named(speciesEntry),
      lineage,
      background: { ...named(bgEntry), abilities: bonus, equipment: bgEquipment },
      classes,
      abilityMethod: method,
      baseAbilities: base,
      rolls,
      speciesChoices: { skills: speciesSkills, size },
      alignment: text.alignment,
      appearance: text.appearance,
      age: text.age,
      languages: text.languages,
      notes: text.notes,
      xp: xp as number,
      hp: { max: null, current: null, temp: 0 },
    },
  };
}
