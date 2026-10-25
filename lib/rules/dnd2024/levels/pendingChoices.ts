// Qué toca elegir al ganar un nivel de clase (spec de subir de nivel §3) y requisitos de multiclase (§4.2). Funciones
// puras: las usan el asistente de subir de nivel, el creador (nivel 1) y la validación del servidor.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type {
  Ability, ClassData, FeatSpellFilter, FeatureData, LevelCounts, LevelFeature, OptionalFeatureData, Ref, SpellcastingMode,
  SubclassData,
} from "@/lib/rules/types";
import type { Derived } from "../derive";
import { refKey } from "../sheet/equipmentRefs";
import {
  BONUS_SPELL_ORIGINS, FEATURE_CHOICES, IMPROVED_ILLUSIONS, IMPROVED_ILLUSIONS_CANTRIP, MAGICAL_DISCOVERIES,
  MAGICAL_SECRETS, MYSTIC_ARCANUM, REPLACEABLE_FIGHTING_STYLE, SCHOOL_SAVANT, SIGNATURE_SPELLS, type ChoiceSpec,
} from "./featureChoices";
import { ABILITY_NAMES, optionalFeatureLabel } from "../sheet/labels";
import type { Choice, Dnd2024SheetV2, FeatPickValue, LevelEntry, Named, SpellChoice, SpellSwap } from "../sheet/sheet";
import { maxSpellLevel, spellListOf } from "../spells/spellcasting";
import { SKILLS_SOURCE, SUBCLASS_SOURCE, summarizeClasses } from "../sheet/upgrade";

/**
 * Elección que pide un nivel. `source` es la clave del rasgo o de la progresión (la misma que lleva la `Choice`):
 * `classFeature:…`, `progression:metamagic|sorcerer|xphb`, `class:skills`, `class:subclass`, `multiclass:ranger|xphb`.
 * `from`: habilidades permitidas o nombres de las opciones escritas a mano; `options`: opciones del catálogo;
 * `category`: categorías de dote (`FS`, `EB`, `G`); `featureType`: tipo de rasgo opcional (`MM`, `EI`…);
 * `optionalReplace`: además puede sustituir uno de los rasgos opcionales (o el estilo de combate) que ya tiene (en la
 * elección de conjuros, un conjuro aprendido); `optionalReplaceCantrip`: en la elección de conjuros, un truco; con
 * `count: 0`, el nivel solo permite esas sustituciones. `spells`: en la elección de conjuros, la clase (o subclase
 * lanzadora), su modo, su lista (`SpellData.classes`), cuántos trucos y conjuros nuevos (aprendidos o entradas del
 * libro) y su nivel máximo; `count` es la suma. `arcanum`: en la elección del Arcano místico, el nivel del conjuro
 * nuevo (sin él, con `count: 0`, el nivel solo permite sustituir uno) y la lista de la que se elige; con
 * `optionalReplace`, puede sustituir uno de los que tiene por otro del mismo nivel. `bonusSpells`: en las elecciones
 * de conjuros que no cuentan para los límites, de dónde se eligen (ver `BonusSpellsPending`).
 */
export type PendingChoice = {
  type: Choice["type"];
  source: string;
  count: number;
  from?: string[];
  options?: Ref[];
  category?: string[];
  featureType?: string[];
  label: string;
  optionalReplace?: boolean;
  optionalReplaceCantrip?: boolean;
  spells?: SpellsPending;
  /**
   * En la elección de conjuros de una dote (`featSpells`): la dote, el filtro de los trucos y el de los conjuros, las
   * características de lanzamiento entre las que se elige y las listas entre las que se elige la de los filtros
   * (Iniciado en la magia base). Los números van en `spells` (con la dote como `class`).
   */
  featSpells?: { feat: Ref; cantrip?: FeatSpellFilter; spell?: FeatSpellFilter; abilities?: Ability[]; lists?: string[] };
  arcanum?: { level?: number; list: string };
  bonusSpells?: BonusSpellsPending;
};

/**
 * Conjuros que da un rasgo fuera de los límites (`bonusSpells`): la clase en cuyo bloque quedan siempre preparados,
 * las listas de las que se eligen, si solo trucos, si del libro de la clase, el nivel exacto (`level`) o el máximo
 * (`maxLevel`, con trucos), y el origen con el que se muestran. Con `optionalReplace` y `count: 0`, el nivel solo
 * permite sustituir uno de los que ya da el rasgo por otro que cumpla lo mismo.
 */
export type BonusSpellsPending = {
  class: Ref;
  lists: string[];
  cantripsOnly?: boolean;
  fromSpellbook?: boolean;
  level?: number;
  maxLevel?: number;
  origin: string;
};

export type SpellsPending = {
  class: Ref;
  mode: SpellcastingMode;
  list: string;
  /**
   * Con Secretos mágicos: las listas de las que puede elegir los conjuros nuevos y los sustitutos (incluida `list`);
   * los trucos, solo de `list`.
   */
  lists?: string[];
  cantrips: number;
  spells: number;
  maxLevel: number;
  /** Sabio de la escuela: conjuros de Mago de la escuela `school` (letra de 5etools) que entran gratis en el libro. */
  free?: { count: number; school: string; maxLevel: number };
};

/** Fuente de la elección de conjuros de una clase o subclase lanzadora. */
export const spellsSource = (caster: Ref) => `progression:spells|${bareKey(caster.key)}`;

const ASI_PREFIX = "classFeature:ability score improvement|";
// Categoría de las dotes generales (la alternativa a la mejora de característica)
const GENERAL_FEATS = ["G"];
const FIGHTING_STYLE = "FS";
const EPIC_BOON = "EB";

// Clases y subclases importadas antes de las progresiones (catálogo sin reimportar o en caché): sin elecciones de ellas
const NO_PROGRESSIONS: Pick<ClassData["progressions"], "feats" | "optionalFeatures"> = { feats: [], optionalFeatures: [] };

const FEAT_LABELS: Record<string, string> = { FS: "Estilo de combate", EB: "Don épico", G: "Dote general" };

/** Opciones de rasgo que dan un truco más de la lista de su clase (Taumaturgo del Clérigo, Mago del Druida). */
export const BONUS_CANTRIPS: Readonly<Record<string, number>> = {
  "classFeature:thaumaturge|cleric|xphb|1": 1,
  "classFeature:magician|druid|xphb|1": 1,
};

/** Trucos de más que dan las opciones de rasgo `options` (claves del catálogo). */
export const bonusCantrips = (options: string[]) => options.reduce((n, k) => n + (BONUS_CANTRIPS[k] ?? 0), 0);

/** Trucos de más de una clase por las opciones de rasgo elegidas en sus niveles del historial. */
export function heldBonusCantrips(levels: LevelEntry[], cls: Ref): number {
  return bonusCantrips(levels.filter((l) => refKey(l.class.ref) === refKey(cls))
    .flatMap((l) => l.choices.flatMap((c) => (c.type === "featureOption" ? [c.value.ref.key] : []))));
}

/**
 * La elección de conjuros de `pending` con los trucos de más de las opciones de rasgo elegidas en ese mismo nivel
 * (`options`: claves del catálogo, p. ej. el Taumaturgo al crear un Clérigo).
 */
export function withBonusCantrips(pending: PendingChoice[], options: string[]): PendingChoice[] {
  const extra = bonusCantrips(options);
  if (!extra) return pending;
  return pending.map((p) => (p.type === "spells" && p.spells
    ? { ...p, count: p.count + extra, spells: { ...p.spells, cantrips: p.spells.cantrips + extra } }
    : p));
}

// Sustituye en `list` el conjuro que sale por el que entra
function applySwap(list: Named[], swap: SpellSwap | undefined) {
  if (!swap) return;
  const i = list.findIndex((s) => refKey(s.ref) === refKey(swap.out.ref));
  if (i >= 0) list.splice(i, 1);
  list.push(swap.in);
}

/**
 * Trucos y conjuros elegidos para una clase en el historial (en modo `spellbook`, las entradas del libro, también las
 * gratis del Sabio de la escuela), con las sustituciones aplicadas en orden.
 */
export function chosenSpells(sheet: Pick<Dnd2024SheetV2, "levels">, cls: Ref): { cantrips: Named[]; spells: Named[] } {
  const cantrips: Named[] = [];
  const spells: Named[] = [];
  for (const l of sheet.levels) {
    for (const c of l.choices) {
      if (c.type !== "spells" || refKey(c.value.class) !== refKey(cls)) continue;
      const v: SpellChoice = c.value;
      cantrips.push(...v.cantrips);
      spells.push(...v.spells, ...(v.free ?? []));
      // El truco sustituido sale de los trucos y el conjuro, de los aprendidos
      applySwap(cantrips, v.replaceCantrip);
      applySwap(spells, v.replace);
    }
  }
  return { cantrips, spells };
}

// Elecciones de un tipo hechas en los niveles de una clase
function classChoices<T extends Choice["type"]>(
  levels: LevelEntry[], cls: Ref, type: T,
): Extract<Choice, { type: T }>[] {
  return levels.filter((l) => refKey(l.class.ref) === refKey(cls))
    .flatMap((l) => l.choices.filter((c): c is Extract<Choice, { type: T }> => c.type === type));
}

/** Arcanos (Arcano místico) que conserva una clase: los elegidos en sus niveles, con las sustituciones en orden. */
export function heldArcana(levels: LevelEntry[], cls: Ref): Named[] {
  const held: Named[] = [];
  for (const c of classChoices(levels, cls, "arcanum")) {
    if (c.value) held.push(c.value);
    applySwap(held, c.replace);
  }
  return held;
}

/**
 * Conjuros que conserva una clase de cada elección `bonusSpells` (por `source`: Descubrimientos mágicos…), con las
 * sustituciones aplicadas en orden.
 */
export function heldBonusSpells(levels: LevelEntry[], cls: Ref): Map<string, Named[]> {
  const held = new Map<string, Named[]>();
  for (const c of classChoices(levels, cls, "bonusSpells")) {
    const list = held.get(c.source) ?? [];
    list.push(...c.value.spells);
    applySwap(list, c.value.replace);
    held.set(c.source, list);
  }
  return held;
}

/**
 * Listas de las que una clase elige sus conjuros (no los trucos) en un nivel de clase por Secretos mágicos (con la
 * suya, `list`); vacío si no tiene el rasgo.
 */
export function secretSpellLists(data: Pick<ClassData, "features"> | undefined, classLevel: number, list: string): string[] {
  const extra = (data?.features ?? []).filter((f) => f.level <= classLevel).flatMap((f) => MAGICAL_SECRETS[f.ref.key] ?? []);
  return extra.length ? [...new Set([list, ...extra])] : [];
}

/** Número acumulado en un nivel: el del mayor nivel de la progresión que no lo supera. */
export function countAt(counts: LevelCounts | null | undefined, level: number): number {
  let best = 0;
  let value = 0;
  for (const [l, n] of Object.entries(counts ?? {})) {
    if (Number(l) <= level && Number(l) >= best) [best, value] = [Number(l), n];
  }
  return value;
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// "classFeature:primal knowledge|barbarian|xphb|3" → "Primal knowledge"
const nameFromKey = (key: string) => capitalize(key.replace(/^[^:]*:/, "").split("|")[0]);
// "class:barbarian|xphb" → "barbarian|xphb"
const bareKey = (key: string) => key.replace(/^[^:]*:/, "");

/**
 * Elecciones que pide el nivel `newClassLevel` de la clase `classRef` (reglas 1–9 de la spec §3). `sheet` es la hoja
 * antes de ese nivel: para el nivel 1 del personaje (crear o rehacer la creación), con `levels` vacío. En el nivel en
 * que se gana la subclase, `opts.subclass` es la elegida, para pedir también lo que da su primer rasgo. `opts.known`:
 * los conjuros que ya tiene por cualquier vía (Ilusiones mejoradas pide otro truco si ya conoce Ilusión menor).
 */
export function pendingChoices(
  sheet: Pick<Dnd2024SheetV2, "levels">,
  classRef: Ref,
  newClassLevel: number,
  entries: Map<string, CatalogEntry>,
  opts: { subclass?: Ref; known?: Ref[] } = {},
): PendingChoice[] {
  const data = entries.get(refKey(classRef))?.data as ClassData | undefined;
  if (!data) return [];
  const entryOf = (r: Ref) => entries.get(refKey(r));
  const nameOf = (r: Ref) => {
    const e = entryOf(r);
    return e ? (e.nameEs ?? e.name) : nameFromKey(r.key);
  };
  const owned = summarizeClasses(sheet.levels).find((c) => refKey(c.class.ref) === refKey(classRef));
  const subclassRef = opts.subclass ?? owned?.subclass?.ref ?? null;
  const subclass = subclassRef ? entryOf(subclassRef) : undefined;
  const subData = subclass?.data as SubclassData | undefined;
  const out: PendingChoice[] = [];
  const classList = spellListOf(classRef, entryOf(classRef)?.identifier);

  // Habilidades de nivel 1: las de la clase si es la primera; las de multiclase si se entra en otra
  if (newClassLevel === 1 && sheet.levels.length === 0 && data.skills.count > 0) {
    out.push({ type: "skills", source: SKILLS_SOURCE, count: data.skills.count, from: data.skills.from, label: "Habilidades de clase" });
  } else if (newClassLevel === 1 && sheet.levels.length > 0 && data.multiclass?.proficiencies.skills) {
    const { count, from } = data.multiclass.proficiencies.skills;
    out.push({ type: "skills", source: `multiclass:${bareKey(classRef.key)}`, count, from, label: "Habilidades de multiclase" });
  }

  // 1. Subclase
  if (newClassLevel === data.subclassLevel) {
    out.push({ type: "subclass", source: SUBCLASS_SOURCE, count: 1, label: data.subclassTitle || "Subclase" });
  }

  const newFeatures = data.features.filter((f) => f.level === newClassLevel);

  // 2. Mejora de característica (o una dote general)
  const asi = newFeatures.find((f) => f.ref.key.startsWith(ASI_PREFIX) || (entryOf(f.ref)?.data as FeatureData)?.asi);
  if (asi) {
    out.push({ type: "asi", source: asi.ref.key, count: 1, category: GENERAL_FEATS, label: "Mejora de característica" });
  }

  // 3 y 4. Dotes y rasgos opcionales de las progresiones de la clase y de su subclase (por nivel de clase)
  const owners = [
    { bare: bareKey(classRef.key), progressions: data.progressions ?? NO_PROGRESSIONS },
    ...(subclass && subData ? [{ bare: bareKey(subclass.ref.key), progressions: subData.progressions ?? NO_PROGRESSIONS }] : []),
  ];
  // Con `count: 0` y `optionalReplace`, el nivel no da ninguno nuevo pero puede sustituir uno de los que ya tiene
  for (const [i, { bare, progressions }] of owners.entries()) {
    for (const p of progressions.feats) {
      const chosen = countAt(p.levels, newClassLevel - 1);
      const count = countAt(p.levels, newClassLevel) - chosen;
      // El estilo de combate de algunas clases se puede cambiar en cada nivel de la clase (no el de la subclase)
      const replace = i === 0 && chosen > 0 && p.category.includes(FIGHTING_STYLE) && REPLACEABLE_FIGHTING_STYLE.has(bare);
      if (count <= 0 && !replace) continue;
      out.push({
        type: "feat", source: `progression:${p.category.join(",").toLowerCase()}|${bare}`, count: Math.max(count, 0),
        // Don épico: o cualquier otra dote general para la que se cumplan los prerrequisitos
        category: p.category.includes(EPIC_BOON) ? [...p.category, ...GENERAL_FEATS] : p.category,
        label: FEAT_LABELS[p.category[0]] ?? "Dote",
        ...(replace ? { optionalReplace: true } : {}),
      });
    }
    // Metamagia, invocaciones y maniobras: se puede sustituir una cada vez que se gana un nivel de la clase
    for (const p of progressions.optionalFeatures) {
      const known = countAt(p.levels, newClassLevel - 1);
      const count = countAt(p.levels, newClassLevel) - known;
      if (count <= 0 && known === 0) continue;
      out.push({
        type: "optionalFeature", source: `progression:${p.name.toLowerCase()}|${bare}`, count: Math.max(count, 0),
        featureType: p.featureType, label: optionalFeatureLabel(p.name), optionalReplace: known > 0,
      });
    }
  }

  // 5. Maestrías con armas
  const masteries = countAt(data.progressions?.weaponMastery, newClassLevel)
    - countAt(data.progressions?.weaponMastery, newClassLevel - 1);
  if (masteries > 0) {
    out.push({
      type: "weaponMastery", source: `progression:weapon mastery|${bareKey(classRef.key)}`, count: masteries,
      label: "Maestría con armas",
    });
  }

  // 6 y 7. Opciones de rasgo y elecciones escritas a mano de los rasgos nuevos de la clase
  // («… Options» con rasgos opcionales de un tipo que ya pide una progresión no piden otra elección; si la opción no
  // está en `entries`, basta con que haya alguna progresión de rasgos opcionales)
  const progressionTypes = owners.flatMap((o) => o.progressions.optionalFeatures.flatMap((p) => p.featureType));
  const covered = (o: Ref) => {
    if (!o.key.startsWith("optionalFeature:") || progressionTypes.length === 0) return false;
    const types = (entryOf(o)?.data as OptionalFeatureData | undefined)?.featureType;
    return !types || types.some((t) => progressionTypes.includes(t));
  };
  const featureChoices = (features: LevelFeature[]) => {
    for (const f of features) {
      const fData = entryOf(f.ref)?.data as (FeatureData & { choices?: ChoiceSpec[] }) | undefined;
      const options = fData?.options ?? [];
      if (options.length > 0 && !options.every(covered)) {
        out.push({ type: "featureOption", source: f.ref.key, count: 1, options, label: nameOf(f.ref) });
      }
      const bonus = bonusSpellsOf(f.ref.key);
      if (bonus) {
        bonusPending.push({
          type: "bonusSpells", source: f.ref.key, count: bonus.count, label: bonus.spec.origin, bonusSpells: bonus.spec,
        });
      }
      for (const spec of FEATURE_CHOICES[f.ref.key] ?? fData?.choices ?? []) {
        out.push({
          type: spec.type, source: f.ref.key, count: spec.count, ...(spec.from ? { from: spec.from } : {}),
          label: nameOf(f.ref),
        });
      }
    }
  };

  // Conjuros fuera de los límites que dan los rasgos (van al final: los del libro pueden ser los de este mismo nivel)
  const bonusPending: PendingChoice[] = [];
  const bonusSpellsOf = (key: string): { count: number; spec: BonusSpellsPending } | null => {
    const origin = BONUS_SPELL_ORIGINS[key];
    if (MAGICAL_DISCOVERIES[key]) {
      // Trucos o conjuros de un nivel para el que tenga espacios
      const maxLevel = data.spellcasting ? maxSpellLevel(data.spellcasting.progression, newClassLevel) : 0;
      return { count: 2, spec: { class: classRef, lists: MAGICAL_DISCOVERIES[key], maxLevel, origin } };
    }
    if (key === SIGNATURE_SPELLS) {
      return { count: 2, spec: { class: classRef, lists: [classList], level: 3, fromSpellbook: true, origin } };
    }
    // Si ya conoce Ilusión menor, otro truco de Mago (si no, la tiene sin elegir: `casterBlocks`)
    if (key === IMPROVED_ILLUSIONS && opts.known?.some((r) => r.key === IMPROVED_ILLUSIONS_CANTRIP)) {
      return { count: 1, spec: { class: classRef, lists: [classList], cantripsOnly: true, origin } };
    }
    return null;
  };

  // Arcano místico: un conjuro de la lista de la clase del nivel que toca y, en cada nivel de la clase después del
  // primer arcano, sustituir uno de los que tiene por otro del mismo nivel. Las hojas de antes del rasgo (sin el arcano
  // de un nivel ya pasado) lo eligen en la siguiente subida, uno por nivel que les falta
  const arcana = data.features.filter((f) => MYSTIC_ARCANUM[f.ref.key] && f.level <= newClassLevel);
  if (arcana.length) {
    const chosen = new Set(classChoices(sheet.levels, classRef, "arcanum").filter((c) => c.value).map((c) => c.source));
    const gained = arcana.find((f) => f.level === newClassLevel);
    const last = arcana.reduce((a, f) => (f.level > a.level ? f : a));
    const missing = arcana.filter((f) => f.level < newClassLevel && !chosen.has(f.ref.key));
    // La sustitución va en la elección del último arcano, si tiene alguno que sustituir
    const replace = chosen.size > 0 ? { optionalReplace: true } : {};
    for (const f of [...missing, ...(gained ? [gained] : [])]) {
      out.push({
        // (los que faltan llevan el nivel del conjuro, para distinguir los pasos)
        type: "arcanum", source: f.ref.key, count: 1,
        label: f === gained ? "Arcano místico" : `Arcano místico (nivel ${MYSTIC_ARCANUM[f.ref.key]})`,
        arcanum: { level: MYSTIC_ARCANUM[f.ref.key], list: classList }, ...(f === last ? replace : {}),
      });
    }
    if (!gained && !missing.includes(last) && chosen.size > 0) {
      out.push({
        type: "arcanum", source: last.ref.key, count: 0, label: "Arcano místico", arcanum: { list: classList }, ...replace,
      });
    }
  }
  featureChoices(newFeatures);

  // 8. Conjuros de la clase o, si no lanza, de su subclase lanzadora (Caballero arcano…): trucos nuevos, conjuros
  // aprendidos (`levelUp`) o entradas del libro (`spellbook`); al subir un nivel que no es el primero, puede
  // sustituir un truco y (en `levelUp`) un conjuro aprendido
  const caster = data.spellcasting
    ? { ref: classRef, casting: data.spellcasting, progressions: data.progressions }
    : subData?.spellcasting && subclass
      ? { ref: subclass.ref, casting: subData.spellcasting, progressions: subData.progressions }
      : null;
  if (caster) {
    const { mode, progression } = caster.casting;
    const at = (list: number[] | null | undefined, level: number) => (level >= 1 ? (list?.[level - 1] ?? 0) : 0);
    const gained = (list: number[] | null | undefined) => Math.max(at(list, newClassLevel) - at(list, newClassLevel - 1), 0);
    // Con un truco de más de una opción de rasgo (Taumaturgo…), los que le falten hasta su límite (los personajes
    // creados antes de contarlo los eligen en su siguiente subida)
    const bonus = heldBonusCantrips(sheet.levels, classRef);
    const cantrips = bonus > 0
      ? Math.max(gained(caster.progressions.cantrips),
        at(caster.progressions.cantrips, newClassLevel) + bonus - chosenSpells(sheet, caster.ref).cantrips.length)
      : gained(caster.progressions.cantrips);
    const spells = mode === "levelUp" ? gained(caster.progressions.prepared)
      : mode === "spellbook" ? at((caster.progressions as Partial<ClassData["progressions"]>).spellbook, newClassLevel)
      : 0;
    const replaceCantrip = at(caster.progressions.cantrips, newClassLevel - 1) > 0;
    const replace = mode === "levelUp" && at(caster.progressions.prepared, newClassLevel - 1) > 0;
    // Sabio de la escuela (solo de la clase): 2 de nivel 2 como máximo al ganarlo y 1 en cada nivel de la clase con un
    // nivel de espacio nuevo
    const isClass = refKey(caster.ref) === refKey(classRef);
    const savant = isClass
      ? subData?.features.find((f) => SCHOOL_SAVANT[f.ref.key] && f.level <= newClassLevel)
      : undefined;
    const school = savant ? SCHOOL_SAVANT[savant.ref.key] : "";
    const maxLevel = maxSpellLevel(progression, newClassLevel);
    // (las hojas de antes del rasgo, sin las que les tocaban, eligen las que les faltan con el nivel máximo actual)
    const freeTotal = (level: number) => (!savant || level < savant.level ? 0
      : 2 + Array.from({ length: level - savant.level }, (_, i) => savant.level + 1 + i)
        .filter((l) => maxSpellLevel(progression, l) > maxSpellLevel(progression, l - 1)).length);
    const freeChosen = classChoices(sheet.levels, caster.ref, "spells").reduce((n, c) => n + (c.value.free?.length ?? 0), 0);
    const freeMissing = freeTotal(newClassLevel) - freeChosen;
    const free = !savant || freeMissing <= 0 ? undefined
      : savant.level === newClassLevel ? { count: 2, school, maxLevel: 2 }
      : { count: freeMissing, school, maxLevel };
    const freeCount = free?.count ?? 0;
    if (cantrips + spells + freeCount > 0 || replace || replaceCantrip) {
      const list = spellListOf(caster.ref, entryOf(caster.ref)?.identifier);
      // Secretos mágicos (solo de la clase, no de una subclase lanzadora)
      const lists = isClass ? secretSpellLists(data, newClassLevel, list) : [];
      out.push({
        type: "spells", source: spellsSource(caster.ref), count: cantrips + spells + freeCount, label: "Conjuros",
        spells: {
          class: caster.ref, mode, list, ...(lists.length ? { lists } : {}),
          cantrips, spells, maxLevel, ...(free ? { free } : {}),
        },
        ...(replace ? { optionalReplace: true } : {}),
        ...(replaceCantrip ? { optionalReplaceCantrip: true } : {}),
      });
    }
  }

  // 9. Rasgos nuevos de la subclase
  if (subData) featureChoices(subData.features.filter((f) => f.level === newClassLevel));

  // Descubrimientos mágicos ganados antes: en cada nivel de la clase puede sustituir uno; las hojas de antes del rasgo
  // (sin ninguno elegido) los eligen todos
  const bonusHeld = heldBonusSpells(sheet.levels, classRef);
  for (const f of [...data.features, ...(subData?.features ?? [])]) {
    const bonus = f.level < newClassLevel && MAGICAL_DISCOVERIES[f.ref.key] ? bonusSpellsOf(f.ref.key) : null;
    if (!bonus) continue;
    const none = !bonusHeld.get(f.ref.key)?.length;
    bonusPending.push({
      type: "bonusSpells", source: f.ref.key, count: none ? bonus.count : 0, label: bonus.spec.origin, bonusSpells: bonus.spec,
      ...(none ? {} : { optionalReplace: true }),
    });
  }

  return [...out, ...bonusPending];
}

/**
 * Requisito de multiclase (13 o más en la característica principal de cada clase actual y de la nueva; con `any`,
 * basta una de las alternativas). Subir en una clase que ya tiene no lo exige.
 */
export function meetsMulticlass(
  sheet: Dnd2024SheetV2,
  derived: Derived,
  newClass: CatalogEntry,
  entries: Map<string, CatalogEntry>,
): { ok: true } | { ok: false; reason: string } {
  const current = summarizeClasses(sheet.levels).map((c) => c.class.ref);
  if (current.some((r) => refKey(r) === refKey(newClass.ref))) return { ok: true };

  const missing: string[] = [];
  const classes = [...current.map((r) => entries.get(refKey(r))?.data), newClass.data] as (ClassData | undefined)[];
  for (const data of classes) {
    const req = data?.multiclass?.requirements;
    if (!req?.abilities.length) continue;
    const low = req.abilities.filter((a) => derived.abilities[a].score < 13);
    if (req.any ? low.length < req.abilities.length : low.length === 0) continue;
    const text = (req.any ? req.abilities : low).map((a: Ability) => `13 en ${ABILITY_NAMES[a]}`).join(req.any ? " o " : " y ");
    if (!missing.includes(text)) missing.push(text);
  }
  return missing.length ? { ok: false, reason: `Necesitas ${missing.join(" y ")}` } : { ok: true };
}

/**
 * Dotes y rasgos opcionales que el personaje conserva de cada elección (por `source`): las elegidas en el historial
 * menos las que se sustituyeron después.
 */
export function heldPicks(levels: LevelEntry[]): Map<string, FeatPickValue[]> {
  const held = new Map<string, FeatPickValue[]>();
  for (const l of levels) {
    for (const c of l.choices) {
      if (c.type !== "feat" && c.type !== "optionalFeature") continue;
      const gone = new Set((c.replaced ?? []).map((r) => refKey(r.ref)));
      held.set(c.source, [...(held.get(c.source) ?? []).filter((p) => !gone.has(refKey(p.ref))), ...c.value]);
    }
  }
  return held;
}

// Lo que conserva de las elecciones de tipo `type`, con el nivel total en que se ganó y la elección que lo dio
function heldWithLevel(levels: LevelEntry[], type: "feat" | "optionalFeature") {
  const held = heldPicks(levels);
  // Si se volvió a elegir una que se había sustituido, cuenta la última vez
  const last = new Map<string, FeatPickValue & { level: number; source: string }>();
  for (const l of levels) {
    for (const c of l.choices) {
      if (c.type !== type) continue;
      for (const f of c.value) {
        if (held.get(c.source)?.some((h) => refKey(h.ref) === refKey(f.ref))) {
          last.set(`${c.source}|${refKey(f.ref)}`, { ...f, level: l.n, source: c.source });
        }
      }
    }
  }
  return [...last.values()];
}

/** Dotes de las elecciones `feat` (estilos de combate, dones épicos…) que conserva, con el nivel total en que se ganaron. */
export function heldFeats(levels: LevelEntry[]): (FeatPickValue & { level: number })[] {
  // (sin `source`, que solo usan los rasgos opcionales)
  return heldWithLevel(levels, "feat")
    .map(({ ref, name, ability, level }) => ({ ref, name, level, ...(ability ? { ability } : {}) }));
}

/**
 * Rasgos opcionales (metamagia, invocaciones, maniobras) que conserva, con el nivel total en que se ganaron y la
 * progresión que los da (`progression:maneuvers|…`).
 */
export function heldOptionalFeatures(levels: LevelEntry[]): (Named & { level: number; source: string })[] {
  return heldWithLevel(levels, "optionalFeature");
}

/** Lo que piden los prerrequisitos de las dotes: nivel total, características, armaduras y lanzamiento de conjuros. */
export type FeatPrerequisiteCtx = {
  level: number;
  abilities: Record<Ability, number>;
  armor: string[];
  spellcasting: boolean;
};

const ABILITY_CODES: Record<string, Ability> = { STR: "str", DEX: "dex", CON: "con", INT: "int", WIS: "wis", CHA: "cha" };

/**
 * Comprueba el texto de prerrequisitos que guarda el importador («Level 4+, STR 13+; or Level 4+, DEX 13+»): basta
 * una de las alternativas separadas por «; or ». Las partes que no se pueden comprobar (rasgos, otros requisitos
 * escritos en texto) se dan por cumplidas.
 */
export function meetsFeatPrerequisite(text: string | undefined, ctx: FeatPrerequisiteCtx): boolean {
  if (!text) return true;
  const part = (bit: string): boolean => {
    const level = /^Level (\d+)\+$/.exec(bit);
    if (level) return ctx.level >= Number(level[1]);
    const abilities = bit.split(" or ").map((a) => /^([A-Z]{3}) (\d+)\+$/.exec(a.trim()));
    if (abilities.every((m) => m && ABILITY_CODES[m[1]])) {
      return abilities.some((m) => ctx.abilities[ABILITY_CODES[m![1]]] >= Number(m![2]));
    }
    if (bit === "Spellcasting") return ctx.spellcasting;
    const armor = /^(light|medium|heavy|shield) armor$/.exec(bit);
    if (armor) return ctx.armor.includes(armor[1]);
    return true;
  };
  return text.split("; or ").some((alt) => alt.split(", ").every((bit) => part(bit.trim())));
}
