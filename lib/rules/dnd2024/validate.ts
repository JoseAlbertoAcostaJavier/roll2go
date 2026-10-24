// Validación en el servidor de la hoja de personaje. Los nombres salen del catálogo, nunca del cliente.
import { cleanText } from "@/lib/utils";
import type { CatalogEntry } from "@/lib/rules/catalog";
import {
  ABILITIES, type Ability, type BackgroundData, type ClassData, type FeatData, type FeatureData, type ItemData,
  type OptionalFeatureData, type Ref, type SpeciesData, type SubclassData,
} from "@/lib/rules/types";
import { POINT_BUY_TOTAL, STANDARD_ARRAY, checkBackgroundBonus, pointBuyCost } from "./abilities";
import { weaponProficient } from "./derive/attacks";
import { FEATURE_OPTION_LABELS } from "./featureChoices";
import { ABILITY_NAMES, SKILL_NAMES, featFitsCategories } from "./labels";
import { meetsFeatPrerequisite, pendingChoices, type FeatPrerequisiteCtx, type PendingChoice } from "./levels";
import { meleeOnlySource, validateMasteries } from "./masteries";
import { abilityRollValue, verifyRolls } from "./rolls";
import { bareName, loadEquipmentEntries, refKey } from "./equipmentRefs";
import {
  ABILITY_METHODS, type AbilityMethod, type Choice, type Dnd2024Sheet, type Dnd2024SheetV2, type Named,
} from "./sheet";
import { SKILLS_SOURCE, upgradeSheet } from "./upgrade";

export type ValidateCtx = {
  userId: string;
  books: string[];
  resolve: (ref: Ref) => Promise<CatalogEntry | null>;
  /** Si la especie tiene algún legado en los libros utilizables (si no hay ninguno, no se exige elegirlo). */
  hasLineages: (species: Ref) => Promise<boolean>;
  /** Id de cada línea del inventario inicial (un ObjectId en texto). */
  makeId: () => string;
  /**
   * Al rehacer la creación: las tiradas que ya tenía el personaje. Si se envían las mismas (valores y token), valen
   * aunque el token haya caducado; se comprobaron al crearlo.
   */
  keptRolls?: { values: number[]; token: string } | null;
};
export type ValidateResult = { ok: true; sheet: Dnd2024SheetV2 } | { ok: false; errors: Record<string, string> };

export const TEXT_LIMITS = { alignment: 40, appearance: 500, age: 500, languages: 500, notes: 10000 } as const;
export const MAX_XP = 355000;
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

  // Clase (por ahora, una sola clase de nivel 1) y sus elecciones de nivel 1, que van a `levels[0].choices`
  const classes: Dnd2024Sheet["classes"] = [];
  let classEntry: CatalogEntry | null = null;
  let choices: Choice[] = [];
  const classEntries = new Map<string, CatalogEntry>();
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
        else if (sEntry) {
          subclass = named(sEntry);
          classEntries.set(refKey(sEntry.ref), sEntry);
        }
        if (!subclass) ok = false;
      }

      // Lo que pide el nivel 1 de la clase (y de la subclase, si ya se elige): sus rasgos y las opciones de estos
      classEntries.set(refKey(cEntry.ref), cEntry);
      const subData = subclass ? (classEntries.get(refKey(subclass.ref))?.data as SubclassData) : undefined;
      const firstFeatures = [...cls.features, ...(subData?.features ?? [])].filter((f) => f.level === 1);
      await loadInto(classEntries, firstFeatures.map((f) => f.ref), ctx.resolve);
      const options = [...classEntries.values()].flatMap((e) => (e.data as FeatureData | null)?.options ?? []);
      await loadInto(classEntries, options, ctx.resolve);
      const pending = pendingChoices({ levels: [] }, cEntry.ref, 1, classEntries, subclass ? { subclass: subclass.ref } : {});
      const checked = await checkChoices(pending, raw.choices, {
        path: "levels.0.choices", entries: classEntries, resolve: ctx.resolve, skills: takenSkills,
        weapons: cls.weapons, level: 1, subclass,
      });
      for (const [k, msg] of Object.entries(checked.errors)) err(k, msg);
      if (Object.keys(checked.errors).length) ok = false;
      choices = checked.choices;

      const eq = raw.equipment;
      if (typeof eq !== "string" || !has(cls.equipment, eq)) err("classes.0.equipment", "Elige el equipo de la clase.");
      if (ok && !errors["classes.0.equipment"]) {
        const skills = choices.find((c) => c.type === "skills" && c.source === SKILLS_SOURCE)?.value as string[] | undefined;
        classes.push({ ...named(cEntry), level: 1, subclass, skills: skills ?? [], equipment: eq as string });
        classEntry = cEntry;
      }
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
      else if (
        !(ctx.keptRolls && r.token === ctx.keptRolls.token && sameValues(r.values, ctx.keptRolls.values))
        && !verifyRolls(ctx.userId, r.values, r.token)
      ) err("rolls", "Las tiradas no son válidas o han caducado.");
      else if (!sameValues(vals, r.values)) err("baseAbilities", "Debes repartir exactamente las tiradas obtenidas.");
      else {
        // Los dados no van firmados: solo se guardan si cuadran con cada tirada
        const values = r.values;
        const dice = Array.isArray(r.dice) && r.dice.length === values.length
          && r.dice.every((d, i) => Array.isArray(d) && d.length === 4
            && d.every((n) => isInt(n) && n >= 1 && n <= 6) && abilityRollValue(d) === values[i])
          ? (r.dice as number[][])
          : null;
        rolls = { values, token: r.token, ...(dice ? { dice } : {}) };
      }
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
  if (!speciesEntry || !bgEntry || !classEntry || classes.length !== 1)
    return { ok: false, errors: { sheet: "Hoja de personaje no válida." } };

  // Se guarda en v2: el nivel 1 en el historial y el equipo inicial volcado al inventario
  const entries = new Map<string, CatalogEntry>([
    [refKey(classEntry.ref), classEntry],
    [refKey(bgEntry.ref), bgEntry],
  ]);
  const classEquipment = (classEntry.data as ClassData).equipment[classes[0].equipment] ?? [];
  await loadEquipmentEntries([classEquipment, bg?.equipment[bgEquipment] ?? []], entries, ctx.resolve);

  const sheet: Dnd2024Sheet = {
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
  };
  const v2 = upgradeSheet(sheet, entries, ctx.makeId);
  v2.levels[0].choices = choices;
  v2.weaponMasteries = choices.flatMap((c) => (c.type === "weaponMastery" ? c.value : []));
  return { ok: true, sheet: v2 };
}

/** Carga en `entries` las referencias que aún no están (las que no existen o no se pueden usar quedan fuera). */
export async function loadInto(
  entries: Map<string, CatalogEntry>, refs: Ref[], resolve: (ref: Ref) => Promise<CatalogEntry | null>,
): Promise<void> {
  const found = await Promise.all(refs.filter((r) => !entries.has(refKey(r))).map((r) => resolve(r)));
  for (const e of found) if (e) entries.set(refKey(e.ref), e);
}

export type ChoicesCtx = {
  /** Prefijo de los errores: `<path>` (falta o sobra alguna) y `<path>.<source>` (una mal elegida). */
  path: string;
  /** Entradas ya cargadas (la clase, sus rasgos y sus opciones); se añaden las que se resuelven aquí. */
  entries: Map<string, CatalogEntry>;
  /** Solo resuelve referencias de los libros utilizables. */
  resolve: (ref: Ref) => Promise<CatalogEntry | null>;
  /** Habilidades con competencia antes de estas elecciones: no se pueden volver a elegir. */
  skills: string[];
  /** Competencias con armas (para las maestrías). */
  weapons: string[];
  /** Nivel de clase (para los prerrequisitos de los rasgos opcionales). */
  level: number;
  /** Subclase elegida en este nivel (se valida aparte; aquí solo se exige si el nivel la pide). */
  subclass: Named | null;
  /** Ruta del error si falta la subclase (por defecto, la del creador). */
  subclassPath?: string;
  /** Si se da, solo se aceptan referencias de estos libros (además de las opciones escritas a mano). */
  books?: string[];
  /** Habilidades con pericia antes de estas elecciones. */
  expertise?: string[];
  /**
   * Personaje al subir de nivel: nivel total tras el nuevo, características actuales y claves de sus dotes. Sin él
   * (creación) no se comprueban prerrequisitos de dotes ni se puede elegir una mejora de característica.
   */
  character?: FeatPrerequisiteCtx & { feats: string[] };
  /** Dotes y rasgos opcionales que conserva de cada elección (`heldPicks`): no se repiten y se pueden sustituir. */
  held?: Map<string, Named[]>;
  /** Armas con las que ya tiene maestría. */
  masteries?: Ref[];
};

const lower = (s: string) => s.toLowerCase();
const ABILITY_CAP = 20;
const EPIC_CAP = 30;
const ASI_POINTS = 2;
// La dote «Ability Score Improvement» es la propia mejora: se elige en la otra pestaña
const ASI_FEAT = "feat:ability score improvement|";
const asRef = (v: unknown): Ref | null => {
  const r = isObj(v) && isObj(v.ref) ? v.ref : v;
  return isObj(r) && typeof r.book === "string" && typeof r.key === "string" ? { book: r.book, key: r.key } : null;
};

/**
 * Comprueba que `raw` trae exactamente las elecciones pendientes (ni más ni menos) y que cada una es válida. Devuelve
 * las elecciones con los nombres del catálogo, en el orden de `pending`.
 */
export async function checkChoices(
  pending: PendingChoice[], raw: unknown, ctx: ChoicesCtx,
): Promise<{ choices: Choice[]; errors: Record<string, string> }> {
  const errors: Record<string, string> = {};
  const err = (key: string, msg: string) => {
    if (!errors[key]) errors[key] = msg;
  };
  const list = raw ?? [];
  if (!Array.isArray(list) || !list.every((c) => isObj(c) && typeof c.type === "string" && typeof c.source === "string")) {
    err(ctx.path, "Elecciones de clase no válidas.");
    return { choices: [], errors };
  }
  const given = list as Obj[];
  const matches = (p: PendingChoice, c: Obj) => c.type === p.type && c.source === p.source;
  if (given.some((c) => !pending.some((p) => matches(p, c)))) err(ctx.path, "Hay elecciones que este nivel no pide.");
  if (pending.some((p) => given.filter((c) => matches(p, c)).length > 1)) err(ctx.path, "Hay elecciones repetidas.");
  const missing = pending.filter((p) => p.type !== "subclass" && p.count > 0 && !given.some((c) => matches(p, c)));
  if (missing.length) err(ctx.path, `Falta elegir: ${missing.map((p) => p.label).join(", ")}.`);

  // Busca una entrada del tipo `kind` en las cargadas o en los libros utilizables
  const load = async (v: unknown, kind: string): Promise<CatalogEntry | null> => {
    const ref = asRef(v);
    if (!ref || !ref.key.startsWith(`${kind}:`) || (ctx.books && !ctx.books.includes(ref.book))) return null;
    const e = ctx.entries.get(refKey(ref)) ?? (await ctx.resolve(ref));
    if (e) ctx.entries.set(refKey(e.ref), e);
    return e;
  };
  const named = (e: CatalogEntry): Named => ({ ref: { book: e.ref.book, key: e.ref.key }, name: e.nameEs || e.name });

  const proficient = ctx.skills.map(lower);
  const expertise: string[] = (ctx.expertise ?? []).map(lower);
  // Características que ya suben en este nivel (para el tope)
  const raised: Partial<Record<Ability, number>> = {};
  const scoreOf = (a: Ability) => (ctx.character?.abilities[a] ?? 0) + (raised[a] ?? 0);
  const raise = (a: Ability, v: number) => { raised[a] = (raised[a] ?? 0) + v; };

  // Dote elegida: prerrequisitos, repetición y la característica que sube (si la dote da +1). Devuelve el error o la
  // característica elegida
  const checkFeat = (e: CatalogEntry, rawAbility: unknown): { error: string } | { ability?: Ability } => {
    const d = e.data as FeatData | null;
    const name = e.nameEs || e.name;
    if (ctx.character && !meetsFeatPrerequisite(d?.prerequisite, ctx.character)) {
      return { error: `no cumples los requisitos de ${name}.` };
    }
    if (ctx.character && !d?.repeatable && ctx.character.feats.includes(e.ref.key)) return { error: `ya tienes ${name}.` };
    const from = d?.abilityIncrease ?? [];
    if (!from.length) return rawAbility === undefined ? {} : { error: `${name} no mejora ninguna característica.` };
    const ability = (rawAbility ?? (from.length === 1 ? from[0] : undefined)) as Ability;
    if (!from.includes(ability)) return { error: `elige qué característica mejora ${name}.` };
    const cap = d?.category === "epicBoon" ? EPIC_CAP : ABILITY_CAP;
    if (ctx.character && scoreOf(ability) + 1 > cap) return { error: `${ABILITY_NAMES[ability]} no puede pasar de ${cap}.` };
    raise(ability, 1);
    return { ability };
  };
  // Lo que sustituye (`replaced`): como mucho uno de los que conserva de esta misma elección, si la elección lo permite
  const replacedOf = (p: PendingChoice, c: Obj): Named[] | null => {
    if (c.replaced === undefined) return [];
    const held = ctx.held?.get(p.source) ?? [];
    const refs = Array.isArray(c.replaced) ? c.replaced.map(asRef) : [null];
    if (!p.optionalReplace || refs.length > 1 || refs.some((r) => !r)) return null;
    const found = (refs as Ref[]).map((r) => held.find((h) => refKey(h.ref) === refKey(r)));
    return found.every(Boolean) ? (found as Named[]) : null;
  };
  // La primera elegida que ya tiene (sin contar las que sustituye, que tampoco pueden volver a elegirse)
  const alreadyHeld = (p: PendingChoice, picked: CatalogEntry[]) => {
    const held = new Set((ctx.held?.get(p.source) ?? []).map((h) => refKey(h.ref)));
    return picked.find((e) => held.has(refKey(e.ref)));
  };

  const out: Choice[] = [];
  for (const p of pending) {
    if (p.type === "subclass") {
      if (!ctx.subclass) err(ctx.subclassPath ?? "classes.0.subclass", "Elige una subclase.");
      else out.push({ type: "subclass", source: p.source, value: ctx.subclass });
      continue;
    }
    const c = given.find((g) => matches(p, g));
    if (!c) continue;
    const bad = (msg: string) => err(`${ctx.path}.${p.source}`, `${p.label}: ${msg}`);
    const value = c.value;
    const chooseN = `elige ${p.count}.`;

    if (p.type === "skills" || p.type === "expertise") {
      if (!isStringList(value) || value.length !== p.count) { bad(chooseN); continue; }
      // Sin lista: cualquier habilidad (la pericia, cualquiera con competencia, que se comprueba abajo)
      const from = p.from?.map(lower) ?? (p.type === "skills" ? Object.keys(SKILL_NAMES) : undefined);
      if (from && !value.every((s) => from.includes(lower(s)))) { bad("alguna no está en la lista."); continue; }
      if (p.type === "skills") {
        if (value.some((s) => proficient.includes(lower(s)))) { bad("repites una habilidad que ya tienes."); continue; }
        proficient.push(...value.map(lower));
      } else {
        if (!value.every((s) => proficient.includes(lower(s)))) { bad("solo en habilidades con competencia."); continue; }
        if (value.some((s) => expertise.includes(lower(s)))) { bad("ya tienes pericia en esa habilidad."); continue; }
        expertise.push(...value.map(lower));
      }
      out.push({ type: p.type, source: p.source, value });
    } else if (p.type === "featureOption") {
      const ref = asRef(value);
      if (p.options?.length) {
        const listed = !!ref && p.options.some((o) => o.book === ref.book && o.key === ref.key);
        const e = listed ? await load(ref, ref!.key.split(":")[0]) : null;
        if (!e) { bad("elige una de las opciones."); continue; }
        out.push({ type: "featureOption", source: p.source, value: named(e) });
      } else {
        // Opciones escritas a mano: `{ book: "builtin", key: "option:…" }`
        const key = ref?.book === "builtin" ? ref.key : "";
        if (!p.from?.includes(key) || !FEATURE_OPTION_LABELS[key]) { bad("elige una de las opciones."); continue; }
        out.push({ type: "featureOption", source: p.source, value: { ref: { book: "builtin", key }, name: FEATURE_OPTION_LABELS[key] } });
      }
    } else if (p.type === "feat") {
      const replaced = replacedOf(p, c);
      if (!replaced) { bad("no puedes sustituir esa dote."); continue; }
      const list: unknown[] = Array.isArray(value) ? value : [];
      const picked = await Promise.all(list.map((v) => load(v, "feat")));
      if (picked.length !== p.count + replaced.length || picked.some((e) => !e)) { bad(chooseN); continue; }
      const feats = picked as CatalogEntry[];
      // (una entrada sin datos válidos cuenta como de otra categoría)
      if (feats.some((e) => !featFitsCategories(e.data as FeatData | null, p.category))) { bad("dote de otra categoría."); continue; }
      if (new Set(feats.map((e) => refKey(e.ref))).size !== feats.length) { bad("dote repetida."); continue; }
      const held = alreadyHeld(p, feats);
      if (held) { bad(`ya tienes ${held.nameEs || held.name}.`); continue; }
      const checked = feats.map((e, k) => checkFeat(e, isObj(list[k]) ? list[k].ability : undefined));
      const failed = checked.find((r): r is { error: string } => "error" in r);
      if (failed) { bad(failed.error); continue; }
      const featValue = feats.map((e, k) => {
        const ability = (checked[k] as { ability?: Ability }).ability;
        return { ...named(e), ...(ability ? { ability } : {}) };
      });
      out.push({ type: "feat", source: p.source, value: featValue, ...(replaced.length ? { replaced } : {}) });
    } else if (p.type === "asi") {
      if (!ctx.character || !isObj(value)) { bad("elige una mejora."); continue; }
      if (isObj(value.abilities) && Object.keys(value).length === 1) {
        // +2 a una característica o +1 a dos, sin pasar de 20
        const parsed = Object.entries(value.abilities) as [Ability, number][];
        const valid = parsed.every(([a, v]) => ABILITIES.includes(a) && (v === 1 || v === 2))
          && parsed.reduce((sum, [, v]) => sum + v, 0) === ASI_POINTS;
        if (!valid) { bad("+2 a una característica o +1 a dos."); continue; }
        const over = parsed.find(([a, v]) => scoreOf(a) + v > ABILITY_CAP);
        if (over) { bad(`${ABILITY_NAMES[over[0]]} no puede pasar de ${ABILITY_CAP}.`); continue; }
        for (const [a, v] of parsed) raise(a, v);
        const abilities = Object.fromEntries(parsed) as Partial<Record<Ability, 1 | 2>>;
        out.push({ type: "asi", source: p.source, value: { abilities } });
      } else if (has(value, "feat") && Object.keys(value).every((k) => k === "feat" || k === "ability")) {
        const e = await load(value.feat, "feat");
        if (!e || e.ref.key.startsWith(ASI_FEAT)) { bad("elige una dote."); continue; }
        if (!featFitsCategories(e.data as FeatData | null, p.category)) { bad("dote de otra categoría."); continue; }
        const r = checkFeat(e, value.ability);
        if ("error" in r) { bad(r.error); continue; }
        out.push({ type: "asi", source: p.source, value: { feat: named(e), ...(r.ability ? { ability: r.ability } : {}) } });
      } else bad("elige una mejora.");
    } else if (p.type === "optionalFeature") {
      const replaced = replacedOf(p, c);
      if (!replaced) { bad("no puedes sustituir esa opción."); continue; }
      const picked = Array.isArray(value) ? await Promise.all(value.map((v) => load(v, "optionalFeature"))) : [];
      if (picked.length !== p.count + replaced.length || picked.some((e) => !e)) { bad(chooseN); continue; }
      const opts = picked as CatalogEntry[];
      const keys = opts.map((e) => e.ref.key);
      if (new Set(keys).size !== keys.length) { bad("opción repetida."); continue; }
      const held = alreadyHeld(p, opts);
      if (held) { bad(`ya tienes ${held.nameEs || held.name}.`); continue; }
      // Los prerrequisitos de pacto o de otro rasgo se cumplen con las elegidas o con las que conserva
      const gone = replaced.map((r) => r.ref.key);
      const have = [...keys, ...(ctx.held?.get(p.source) ?? []).map((h) => h.ref.key).filter((k) => !gone.includes(k))];
      const unmet = opts.find((e) => {
        const d = e.data as OptionalFeatureData | null;
        const pre = d?.prerequisite;
        return !d?.featureType?.some((t) => p.featureType?.includes(t)) || (pre?.level ?? 0) > ctx.level
          || (!!pre?.pact && !have.includes(pre.pact)) || (!!pre?.feature && !have.includes(pre.feature));
      });
      if (unmet) { bad(`no cumples los requisitos de ${unmet.nameEs || unmet.name}.`); continue; }
      out.push({ type: "optionalFeature", source: p.source, value: opts.map(named), ...(replaced.length ? { replaced } : {}) });
    } else if (p.type === "weaponMastery") {
      const refs = Array.isArray(value) ? value.map(asRef) : [];
      if (refs.some((r) => !r)) { bad(chooseN); continue; }
      const weapons = refs as Ref[];
      await loadInto(ctx.entries, weapons.filter((r) => r.key.startsWith("item:")), ctx.resolve);
      const checked = validateMasteries(weapons, {
        allowed: p.count,
        entries: ctx.entries,
        meleeOnly: meleeOnlySource(p.source),
        proficientWith: (item) => weaponProficient(item.data as ItemData, [item.name, bareName(item.ref.key)], ctx.weapons),
      });
      if (!checked.ok) { bad(checked.error); continue; }
      const repeated = weapons.find((w) => ctx.masteries?.some((m) => refKey(m) === refKey(w)));
      if (repeated) {
        const e = ctx.entries.get(refKey(repeated));
        bad(`ya tienes maestría con ${e ? e.nameEs || e.name : "esa arma"}.`);
        continue;
      }
      out.push({ type: "weaponMastery", source: p.source, value: weapons });
    } else {
      bad("esta elección todavía no se puede hacer aquí.");
    }
  }
  return { choices: out, errors };
}
