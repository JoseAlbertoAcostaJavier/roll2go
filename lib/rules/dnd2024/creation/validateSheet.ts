// Validación en el servidor de la hoja de personaje. Los nombres salen del catálogo, nunca del cliente.
import { cleanText } from "@/lib/utils/utils";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import {
  ABILITIES, type Ability, type BackgroundData, type ClassData, type FeatData, type FeatureData,
  type ItemData, type LineageData, type Pack, type Ref, type SpeciesData, type SubclassData,
} from "@/lib/rules/types";
import { POINT_BUY_TOTAL, STANDARD_ARRAY, checkBackgroundBonus, pointBuyCost } from "./abilities";
import { checkChoices, loadInto } from "./checkChoices";
import { checkFeatSpells } from "./checkFeatSpells";
import { checkLanguages, fixedLanguages, languageSlots } from "./languages";
import { has, isObj, isStringList } from "./rawInput";
import { splitFeatSpells } from "../spells/featSpells";
import { pendingChoices } from "../levels/pendingChoices";
import { abilityRollValue, verifyRolls } from "./rolls";
import { bareName, choiceMatches, loadEquipmentEntries, refKey } from "../sheet/equipmentRefs";
import {
  ABILITY_METHODS, type AbilityMethod, type Choice, type Dnd2024Sheet, type Dnd2024SheetV2, type Named,
} from "../sheet/sheet";
import { SKILLS_SOURCE, upgradeSheet } from "../sheet/upgrade";
import { TEXT_LIMITS } from "../sheet/textFields";

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

export { TEXT_LIMITS };
export const MAX_XP = 355000;
type Size = "S" | "M" | "L";
const SIZES: Size[] = ["S", "M", "L"];

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const sameValues = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);

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
  // Objetos elegidos para los `Pack` con `choose` de la opción de equipo: uno por cada uno, del tipo que pide, del
  // catálogo de los libros del personaje y no mágico. Devuelve los picks limpios (o `undefined` si no hay ninguno).
  async function checkPicks(path: string, packs: Pack[], raw: unknown): Promise<Record<string, Ref> | undefined> {
    const picks: Record<string, Ref> = {};
    if (raw != null && !isObj(raw)) {
      err(path, "Petición no válida.");
      return undefined;
    }
    const given = raw ?? {};
    if (Object.keys(given).some((k) => !packs[Number(k)]?.choose || String(Number(k)) !== k)) {
      err(path, "Petición no válida.");
      return undefined;
    }
    for (const [i, p] of packs.entries()) {
      if (!p.choose) continue;
      const pick = given[String(i)];
      if (pick == null) {
        err(path, `Falta elegir: ${p.choose.label}.`);
        continue;
      }
      const notValid = `Ese objeto no vale para ${p.choose.label}.`;
      if (!isObj(pick) || typeof pick.book !== "string" || typeof pick.key !== "string"
        || !pick.key.startsWith("item:") || !ctx.books.includes(pick.book)) {
        err(path, notValid);
        continue;
      }
      const ref: Ref = { book: pick.book, key: pick.key };
      const data = (await ctx.resolve(ref))?.data as ItemData | undefined;
      if (!data || data.rarity || !p.choose.kinds.some((k) => choiceMatches(k, data))) err(path, notValid);
      else picks[String(i)] = ref;
    }
    return Object.keys(picks).length ? picks : undefined;
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
  let bgPicks: Record<string, Ref> | undefined;
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
    else {
      bgEquipment = eq;
      bgPicks = await checkPicks("background.equipmentPicks", bg.equipment[eq], input.background.equipmentPicks);
    }
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
      // (y los de las invocaciones elegidas en el nivel 1: Pacto del tomo, y sin repetir uno elegido para la clase)
      const featSpells = await checkFeatSpells(split.featSpells, bg?.feat, bgFeat, checked.choices, classEntries, ctx);
      for (const [k, msg] of Object.entries({ ...featSpells.errors, ...checked.errors })) err(k, msg);
      if (Object.keys(checked.errors).length || Object.keys(featSpells.errors).length) ok = false;
      choices = [...checked.choices, ...featSpells.choices];

      const eq = raw.equipment;
      if (typeof eq !== "string" || !has(cls.equipment, eq)) err("classes.0.equipment", "Elige el equipo de la clase.");
      let classPicks: Record<string, Ref> | undefined;
      if (typeof eq === "string" && has(cls.equipment, eq))
        classPicks = await checkPicks("classes.0.equipmentPicks", cls.equipment[eq], raw.equipmentPicks);
      if (ok && !errors["classes.0.equipment"] && !errors["classes.0.equipmentPicks"]) {
        const skills = choices.find((c) => c.type === "skills" && c.source === SKILLS_SOURCE)?.value as string[] | undefined;
        classes.push({ ...named(cEntry), level: 1, subclass, skills: skills ?? [], equipment: eq as string,
          ...(classPicks ? { equipmentPicks: classPicks } : {}),
        });
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

  // Idiomas: los de origen y, según la clase, los del Pícaro (los fijos no se eligen). `languages` de texto se ignora
  let languageChoices: Ref[] = [];
  if (classEntry) {
    const levels = { [bareName(classEntry.ref.key)]: 1 };
    const raw = input.languageChoices ?? [];
    const refs: Ref[] = [];
    const langEntries = new Map<string, CatalogEntry>();
    let shape = Array.isArray(raw);
    for (const r of Array.isArray(raw) ? raw : []) {
      if (!isObj(r) || typeof r.book !== "string" || typeof r.key !== "string" || !r.key.startsWith("language:")
        || !ctx.books.includes(r.book)) shape = false;
      else {
        const ref: Ref = { book: r.book, key: r.key };
        const e = await ctx.resolve(ref);
        if (e) langEntries.set(refKey(ref), e);
        refs.push(ref);
      }
    }
    const msg = !shape ? "Idiomas no válidos."
      : checkLanguages(refs, languageSlots(levels), fixedLanguages(levels), (r) => langEntries.get(refKey(r)) ?? null);
    if (msg) err("languageChoices", msg);
    else languageChoices = refs;
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
  await loadEquipmentEntries([classEquipment, bg?.equipment[bgEquipment] ?? []], entries, ctx.resolve,
    [...Object.values(classes[0].equipmentPicks ?? {}), ...Object.values(bgPicks ?? {})]);

  const sheet: Dnd2024Sheet = {
    version: 1,
    species: named(speciesEntry),
    lineage,
    background: { ...named(bgEntry), abilities: bonus, equipment: bgEquipment, ...(bgPicks ? { equipmentPicks: bgPicks } : {}) },
    classes,
    abilityMethod: method,
    baseAbilities: base,
    rolls,
    speciesChoices: { skills: speciesSkills, size },
    alignment: text.alignment,
    appearance: text.appearance,
    age: text.age,
    languages: text.languages,
    languageChoices,
    notes: text.notes,
    xp: xp as number,
    hp: { max: null, current: null, temp: 0 },
  };
  const v2 = upgradeSheet(sheet, entries, ctx.makeId);
  v2.levels[0].choices = choices;
  v2.weaponMasteries = choices.flatMap((c) => (c.type === "weaponMastery" ? c.value : []));
  return { ok: true, sheet: v2 };
}
