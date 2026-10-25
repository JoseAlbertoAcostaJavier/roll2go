// Validación en el servidor de la hoja de personaje. Los nombres salen del catálogo, nunca del cliente.
import { cleanText } from "@/lib/utils";
import type { CatalogEntry } from "@/lib/rules/catalog";
import {
  ABILITIES, type Ability, type BackgroundData, type ClassData, type FeatData, type FeatureData, type ItemData,
  type LineageData, type OptionalFeatureData, type Ref, type SpeciesData, type SpellData, type SubclassData,
} from "@/lib/rules/types";
import { POINT_BUY_TOTAL, STANDARD_ARRAY, checkBackgroundBonus, pointBuyCost } from "./abilities";
import { abilityScores } from "./derive/abilities";
import { weaponProficient } from "./derive/attacks";
import { casterBlocks, spellSlots } from "./derive/spells";
import { FEATURE_OPTION_LABELS } from "./featureChoices";
import {
  checkFeatSpellChoices, featSpellClash, featSpellPending, featSpellsSource, splitFeatSpells, type FeatWithData,
} from "./featSpells";
import { ABILITY_NAMES, SKILL_NAMES, featFitsCategories } from "./labels";
import {
  meetsFeatPrerequisite, pendingChoices, withBonusCantrips, type BonusSpellsPending, type FeatPrerequisiteCtx,
  type PendingChoice,
} from "./levels";
import { meleeOnlySource, validateMasteries } from "./masteries";
import { abilityRollValue, verifyRolls } from "./rolls";
import { bareName, isRef, loadEquipmentEntries, refKey } from "./equipmentRefs";
import { preparedKey } from "./spellcasting";
import { applySpellOp } from "./spellOps";
import {
  ABILITY_METHODS, type AbilityMethod, type BonusSpellsValue, type Choice, type Dnd2024Sheet, type Dnd2024SheetV2,
  type Named, type SpellChoice, type SpellSwap,
} from "./sheet";
import { spellSchoolName } from "./spellTextClient";
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
  let lineageData: LineageData | null = null;
  if (species && speciesEntry) {
    if (input.lineage == null) {
      if (species.hasLineages && (await ctx.hasLineages(speciesEntry.ref))) err("lineage", "Elige un legado.");
    } else if (!species.hasLineages) {
      err("lineage", "Esta especie no tiene legados.");
    } else {
      const l = await load("lineage", input.lineage, "lineage");
      if (l) {
        if (!isChildOf(l, speciesEntry)) err("lineage", "El legado no pertenece a la especie elegida.");
        else {
          lineage = named(l);
          lineageData = l.data as LineageData;
        }
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
      // Conjuros de nivel 1 que ya da otra cosa: especie, legado, dote del trasfondo, clase y subclase
      const bgFeat = bg?.feat ? ((await ctx.resolve(bg.feat))?.data as FeatData | undefined) : undefined;
      const spellsGranted = [species?.spells, lineageData?.spells, bgFeat?.spells, cls.spells, subData?.spells]
        .flatMap((list) => (list ?? []).filter((g) => g.level <= 1).map((g) => g.ref));
      // (los conjuros de la dote del trasfondo, aparte)
      const split = splitFeatSpells(raw.choices);
      const checked = await checkChoices(pending, split.rest, {
        path: "levels.0.choices", entries: classEntries, resolve: ctx.resolve, skills: takenSkills,
        weapons: cls.weapons, level: 1, subclass, spellsGranted,
      });
      // (y los de las invocaciones elegidas en el nivel 1: Pacto del tomo)
      const featEntry = bgFeat && bg ? await ctx.resolve(bg.feat) : null;
      const withSpells: FeatWithData[] = [
        ...(featEntry ? [{ ref: featEntry.ref, name: featEntry.nameEs || featEntry.name, data: bgFeat }] : []),
        ...checked.choices.flatMap((c) => (c.type === "optionalFeature" ? c.value : [])).map((o) => ({
          ref: o.ref, name: o.name, data: classEntries.get(refKey(o.ref))?.data as OptionalFeatureData | undefined,
        })),
      ];
      const featSpells = await checkFeatSpellChoices(
        featSpellPending(withSpells, (l) => l <= 1),
        split.featSpells, { path: "levels.0.choices", books: ctx.books, resolve: ctx.resolve },
      );
      // El mismo conjuro no se elige a la vez con la dote y para la clase
      const clash = featSpellClash([...checked.choices, ...featSpells.choices]);
      // (sin pisar un error anterior de esa elección: gana el primero, como en `err`)
      const clashKey = clash ? `levels.0.choices.${clash.source}` : "";
      if (clash && !(clashKey in featSpells.errors)) {
        const label = withSpells.find((f) => featSpellsSource(f.ref) === clash.source)?.name ?? "";
        featSpells.errors[clashKey] = `Conjuros de ${label}: ${clash.name} ya lo eliges con la clase.`;
      }
      for (const [k, msg] of Object.entries({ ...featSpells.errors, ...checked.errors })) err(k, msg);
      if (Object.keys(checked.errors).length || Object.keys(featSpells.errors).length) ok = false;
      choices = [...checked.choices, ...featSpells.choices];

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
  const prepared = await initialPrepared(v2, input.prepared, classEntries, ctx);
  if ("error" in prepared) return { ok: false, errors: { prepared: prepared.error } };
  v2.prepared = prepared.prepared;
  return { ok: true, sheet: v2 };
}

/**
 * Preparados iniciales (`{ [clave de la clase]: Ref[] }`, modos `list` y `spellbook`): se comprueban como si se
 * preparasen uno a uno en la ficha (lista o libro de la clase, nivel y límite, que nunca se supera).
 */
async function initialPrepared(
  sheet: Dnd2024SheetV2, raw: unknown, classEntries: Map<string, CatalogEntry>, ctx: ValidateCtx,
): Promise<{ prepared: Record<string, Ref[]> } | { error: string }> {
  if (raw == null) return { prepared: {} };
  const lists = isObj(raw) ? Object.entries(raw) : null;
  if (!lists || !lists.every(([, refs]) => Array.isArray(refs) && refs.every(isRef)))
    return { error: "Conjuros preparados no válidos." };
  const entries = new Map(classEntries);
  const refs = lists.flatMap(([, list]) => list as Ref[]);
  await loadInto(entries, refs.filter((r) => r.key.startsWith("spell:") && ctx.books.includes(r.book)), ctx.resolve);
  const blocks = casterBlocks(sheet, { abilities: abilityScores(sheet), proficiencyBonus: 0 }, entries);
  const opCtx = { blocks, slots: spellSlots(sheet, entries), resolve: (r: Ref) => entries.get(refKey(r)) ?? null };
  let current = sheet;
  for (const [key, list] of lists) {
    const block = blocks.find((b) => preparedKey(b.class) === key);
    for (const ref of list as Ref[]) {
      const r = applySpellOp(current, { op: "prepare", class: block?.class ?? null, ref }, opCtx);
      if (!r.ok) return { error: r.error };
      current = r.sheet;
    }
  }
  return { prepared: current.prepared };
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
  /**
   * Trucos y conjuros que ya tiene una clase lanzadora (aprendidos o, en modo `spellbook`, su libro): no se repiten y
   * de ahí sale el que se sustituye. Sin él (creación), ninguno.
   */
  spellsHeld?: (cls: Ref, mode: SpellChoiceMode) => { cantrips: Named[]; spells: Named[] };
  /** Conjuros que ya tiene por otras vías (siempre preparados, especie, legado, dotes…): tampoco se pueden elegir. */
  spellsGranted?: Ref[];
  /** Arcanos (Arcano místico) que ya tiene la clase: no se repiten y de ahí sale el que se sustituye. */
  arcana?: Named[];
  /** Conjuros que conserva de cada elección `bonusSpells` (por `source`): de ahí sale el que se sustituye. */
  bonusHeld?: Map<string, Named[]>;
};
type SpellChoiceMode = NonNullable<PendingChoice["spells"]>["mode"];

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
    } else if (p.type === "spells" && p.spells) {
      // Con los trucos de más de las opciones de rasgo de este nivel, que ya están comprobadas (van antes)
      const options = out.flatMap((o) => (o.type === "featureOption" ? [o.value.ref.key] : []));
      const [withBonus] = withBonusCantrips([p], options);
      const r = await checkSpells(withBonus, withBonus.spells!, value, ctx, load);
      if ("error" in r) { bad(r.error); continue; }
      out.push({ type: "spells", source: p.source, value: r.value });
    } else if (p.type === "arcanum" && p.arcanum) {
      // Arcano místico: un conjuro de la lista de la clase del nivel exacto, que no tenga ya por otra vía, y (si el
      // nivel lo permite) uno de los que tiene sustituido por otro de la lista del mismo nivel
      const arcana = ctx.arcana ?? [];
      const taken = new Set([...arcana.map((a) => a.ref), ...(ctx.spellsGranted ?? [])].map(refKey));
      const fitsArcanum = (e: CatalogEntry, level: number): string | null => {
        const d = e.data as SpellData | null;
        const name = e.nameEs || e.name;
        if (!d?.classes?.includes(p.arcanum!.list)) return `${name} no está en la lista de la clase.`;
        if (d.level !== level) return `${name} no es un conjuro de nivel ${level}.`;
        return taken.has(refKey(e.ref)) ? `ya tienes ${name}.` : null;
      };
      let arcanum: Named | null = null;
      if (p.count > 0) {
        const e = await load(value, "spell");
        if (!e?.data) { bad("elige un conjuro."); continue; }
        const error = fitsArcanum(e, p.arcanum.level ?? 0);
        if (error) { bad(error); continue; }
        arcanum = named(e);
        taken.add(refKey(e.ref));
      } else if (value !== null && value !== undefined) {
        bad("en este nivel solo puedes sustituir un arcano.");
        continue;
      }
      const swap = await checkSwap(c.replace, !!p.optionalReplace, arcana, load, async (e, gone) => {
        const goneData = (await load(gone.ref, "spell"))?.data as SpellData | null | undefined;
        return goneData ? fitsArcanum(e, goneData.level) : "conjuro no disponible.";
      });
      if ("error" in swap) { bad(swap.error); continue; }
      if (p.count === 0 && !swap.swap) { bad("elige el arcano que sustituyes."); continue; }
      out.push({ type: "arcanum", source: p.source, value: arcanum, ...(swap.swap ? { replace: swap.swap } : {}) });
    } else if (p.type === "bonusSpells" && p.bonusSpells) {
      const r = await checkBonusSpells(p, p.bonusSpells, value, out, ctx, load);
      if ("error" in r) { bad(r.error); continue; }
      out.push({ type: "bonusSpells", source: p.source, value: r.value });
    } else {
      bad("esta elección todavía no se puede hacer aquí.");
    }
  }
  return { choices: out, errors };
}

type Load = (v: unknown, kind: string) => Promise<CatalogEntry | null>;
const toNamed = (e: CatalogEntry): Named => ({ ref: { book: e.ref.book, key: e.ref.key }, name: e.nameEs || e.name });

// Sustitución opcional `raw` (`{ out, in }`) de uno de `held` por otro que cumpla `fits` (que recibe también el que
// sale). Sin ella, `swap` vacío
async function checkSwap(
  raw: unknown, allowed: boolean, held: Named[], load: Load,
  fits: (e: CatalogEntry, gone: Named) => Promise<string | null> | string | null,
): Promise<{ error: string } | { swap?: SpellSwap }> {
  if (raw === undefined) return {};
  if (!allowed || !isObj(raw)) return { error: "no puedes sustituir conjuros en este nivel." };
  const outRef = asRef(raw.out);
  const gone = outRef ? held.find((h) => refKey(h.ref) === refKey(outRef)) : undefined;
  if (!gone) return { error: "solo puedes sustituir uno que ya tienes." };
  const inEntry = await load(raw.in, "spell");
  if (!inEntry?.data) return { error: "conjuro no disponible." };
  const error = await fits(inEntry, gone);
  return error ? { error } : { swap: { out: gone, in: toNamed(inEntry) } };
}

// Conjuros de un rasgo fuera de los límites (Descubrimientos mágicos, Ilusiones mejoradas, Conjuros distintivos):
// exactamente `count`, de sus listas (o de su libro) y del nivel que piden, sin repetir los que ya tiene (tampoco los
// elegidos en este nivel, `earlier`) y, si el nivel lo permite, uno de los que ya da el rasgo sustituido por otro
async function checkBonusSpells(
  pending: PendingChoice, b: BonusSpellsPending, raw: unknown, earlier: Choice[], ctx: ChoicesCtx, load: Load,
): Promise<{ error: string } | { value: BonusSpellsValue }> {
  if (!isObj(raw)) return { error: "elige los conjuros." };
  const nameOf = (e: CatalogEntry) => e.nameEs || e.name;
  const held = ctx.bonusHeld?.get(pending.source) ?? [];
  // Lo elegido para la clase en este mismo nivel (entra en el libro o en los conocidos)
  const levelSpells = earlier.flatMap((c) => (c.type === "spells" && refKey(c.value.class) === refKey(b.class)
    ? [c.value.cantrips, c.value.spells, c.value.free ?? [], [c.value.replace?.in, c.value.replaceCantrip?.in]].flat()
    : [])).filter((n): n is Named => !!n);
  const classHeld = ctx.spellsHeld?.(b.class, b.fromSpellbook ? "spellbook" : "levelUp") ?? { cantrips: [], spells: [] };
  const book = new Set([...classHeld.spells, ...levelSpells].map((n) => refKey(n.ref)));
  // Los del libro pueden ser cualquiera de él; los demás, ninguno que ya tenga
  const taken = new Set([
    ...held.map((h) => refKey(h.ref)),
    ...(b.fromSpellbook ? [] : [
      ...[...classHeld.cantrips, ...classHeld.spells, ...levelSpells].map((n) => refKey(n.ref)),
      ...(ctx.spellsGranted ?? []).map(refKey),
    ]),
  ]);
  const fits = (e: CatalogEntry): string | null => {
    const d = e.data as SpellData | null;
    if (!d) return "conjuro no disponible.";
    if (b.fromSpellbook && !book.has(refKey(e.ref))) return `${nameOf(e)} no está en tu libro de conjuros.`;
    if (!b.fromSpellbook && !d.classes?.some((c) => b.lists.includes(c))) return `${nameOf(e)} no está en una lista permitida.`;
    if (b.cantripsOnly && d.level !== 0) return `${nameOf(e)} no es un truco.`;
    if (b.level !== undefined && d.level !== b.level) return `${nameOf(e)} no es un conjuro de nivel ${b.level}.`;
    if (b.maxLevel !== undefined && d.level > b.maxLevel)
      return `${nameOf(e)} es de nivel ${d.level}; el máximo es ${b.maxLevel}.`;
    return taken.has(refKey(e.ref)) ? `ya tienes ${nameOf(e)}.` : null;
  };

  const items = raw.spells ?? [];
  if (!Array.isArray(items) || items.length !== pending.count) {
    return { error: `elige ${pending.count} ${pending.count === 1 ? "conjuro" : "conjuros"}.` };
  }
  const found = await Promise.all(items.map((v) => load(v, "spell")));
  if (found.some((e) => !e)) return { error: "conjuro no disponible." };
  for (const e of found as CatalogEntry[]) {
    const error = fits(e);
    if (error) return { error };
    taken.add(refKey(e.ref));
  }
  const value: BonusSpellsValue = { spells: (found as CatalogEntry[]).map(toNamed) };
  const swap = await checkSwap(raw.replace, !!pending.optionalReplace, held, load, fits);
  if ("error" in swap) return swap;
  if (swap.swap) value.replace = swap.swap;
  else if (pending.count === 0) return { error: "elige el conjuro que sustituyes." };
  return { value };
}

// Elección de conjuros (spec de conjuros §2.4): exactamente los trucos y conjuros nuevos que pide el nivel, de la
// lista de la clase (los conjuros, también de las de Secretos mágicos: `p.lists`) y de nivel permitido, sin repetir
// los que ya tiene; las entradas gratis del libro del Sabio de la escuela (`p.free`, hasta su número), de su escuela;
// y, si el nivel lo permite, sustituir un conjuro aprendido (`replace`) y un truco (`replaceCantrip`) por otro del
// mismo tipo
async function checkSpells(
  pending: PendingChoice, p: NonNullable<PendingChoice["spells"]>, raw: unknown, ctx: ChoicesCtx, load: Load,
): Promise<{ error: string } | { value: SpellChoice }> {
  if (!isObj(raw)) return { error: "elige los conjuros." };
  const given = asRef(raw.class);
  if (given && refKey(given) !== refKey(p.class)) return { error: "conjuros de otra clase." };
  const held = ctx.spellsHeld?.(p.class, p.mode) ?? { cantrips: [], spells: [] };
  const heldKeys = new Set([...held.cantrips, ...held.spells].map((h) => refKey(h.ref)));
  for (const r of ctx.spellsGranted ?? []) heldKeys.add(refKey(r));
  const nameOf = (e: CatalogEntry) => e.nameEs || e.name;
  // Comprueba un conjuro: de la lista, truco o de nivel 1..máximo
  const fits = (e: CatalogEntry, cantrip: boolean): string | null => {
    const d = e.data as SpellData | null;
    const lists = cantrip ? [p.list] : (p.lists ?? [p.list]);
    if (!d?.classes?.some((c) => lists.includes(c))) return `${nameOf(e)} no está en la lista de la clase.`;
    if (cantrip ? d.level !== 0 : d.level < 1) return `${nameOf(e)} no es ${cantrip ? "un truco" : "un conjuro de nivel 1 o más"}.`;
    if (!cantrip && d.level > p.maxLevel) return `${nameOf(e)} es de nivel ${d.level}; el máximo es ${p.maxLevel}.`;
    return null;
  };
  const pick = async (list: unknown, count: number, cantrip: boolean): Promise<{ error: string } | CatalogEntry[]> => {
    const what = cantrip ? (count === 1 ? "truco" : "trucos") : (count === 1 ? "conjuro" : "conjuros");
    const items = list ?? [];
    if (!Array.isArray(items) || items.length !== count) return { error: `elige ${count} ${what}.` };
    const found = await Promise.all(items.map((v) => load(v, "spell")));
    if (found.some((e) => !e)) return { error: "conjuro no disponible." };
    for (const e of found as CatalogEntry[]) {
      const bad = fits(e, cantrip);
      if (bad) return { error: bad };
      if (heldKeys.has(refKey(e.ref))) return { error: `ya tienes ${nameOf(e)}.` };
    }
    return found as CatalogEntry[];
  };

  const cantrips = await pick(raw.cantrips, p.cantrips, true);
  if ("error" in cantrips) return cantrips;
  const spells = await pick(raw.spells, p.spells, false);
  if ("error" in spells) return spells;
  // Sabio de la escuela: de la lista de la clase, de su escuela y de nivel 1..su máximo
  let free: CatalogEntry[] = [];
  if (p.free) {
    const f = p.free;
    const school = spellSchoolName(f.school);
    const items = raw.free ?? [];
    // («puedes añadir»: de 0 a `count`)
    if (!Array.isArray(items) || items.length > f.count)
      return { error: `elige hasta ${f.count} ${f.count === 1 ? "conjuro gratis" : "conjuros gratis"} de ${school}.` };
    const found = await Promise.all(items.map((v) => load(v, "spell")));
    if (found.some((e) => !e)) return { error: "conjuro no disponible." };
    for (const e of found as CatalogEntry[]) {
      const d = e.data as SpellData | null;
      if (!d?.classes?.includes(p.list)) return { error: `${nameOf(e)} no está en la lista de la clase.` };
      if (d.school !== f.school) return { error: `${nameOf(e)} no es de ${school}.` };
      if (d.level < 1 || d.level > f.maxLevel)
        return { error: `${nameOf(e)} no es un conjuro de nivel 1 a ${f.maxLevel}.` };
      if (heldKeys.has(refKey(e.ref))) return { error: `ya tienes ${nameOf(e)}.` };
    }
    free = found as CatalogEntry[];
  }
  const chosen = [...cantrips, ...spells, ...free];
  if (new Set(chosen.map((e) => refKey(e.ref))).size !== chosen.length) return { error: "conjuro repetido." };

  const value: SpellChoice = {
    class: p.class, cantrips: cantrips.map(toNamed), spells: spells.map(toNamed),
    ...(p.free ? { free: free.map(toNamed) } : {}),
  };
  // Sustituciones: un conjuro aprendido (solo `levelUp`: nunca sale uno del libro del Mago) y un truco
  const swaps = [
    { field: "replace", cantrip: false, allowed: !!pending.optionalReplace && p.mode === "levelUp", from: held.spells },
    { field: "replaceCantrip", cantrip: true, allowed: !!pending.optionalReplaceCantrip, from: held.cantrips },
  ] as const;
  for (const s of swaps) {
    const rawSwap = raw[s.field];
    if (rawSwap === undefined) continue;
    if (!s.allowed || !isObj(rawSwap)) return { error: `no puedes sustituir ${s.cantrip ? "trucos" : "conjuros"} en este nivel.` };
    const outRef = asRef(rawSwap.out);
    const out = outRef ? s.from.find((h) => refKey(h.ref) === refKey(outRef)) : undefined;
    if (!out) return { error: `solo puedes sustituir ${s.cantrip ? "un truco" : "un conjuro"} que ya conoces.` };
    const inEntry = await load(rawSwap.in, "spell");
    if (!inEntry) return { error: "conjuro no disponible." };
    const bad = fits(inEntry, s.cantrip);
    if (bad) return { error: bad };
    if (heldKeys.has(refKey(inEntry.ref)) || chosen.some((e) => refKey(e.ref) === refKey(inEntry.ref)))
      return { error: `ya tienes ${nameOf(inEntry)}.` };
    chosen.push(inEntry);
    value[s.field] = { out, in: toNamed(inEntry) };
  }
  return { value };
}
