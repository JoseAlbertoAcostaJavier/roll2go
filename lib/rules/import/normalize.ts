// Normalización de los JSON de 5etools a entradas del catálogo (`BookEntry`) validadas con `validateEntryData`.
//
// Las referencias a otras entradas se construyen con `book: BOOK_PLACEHOLDER`; el script de importación lo
// sustituye por el id del libro que está importando. `parent` solo guarda la clave (`{ key }`), porque el
// padre siempre está en el mismo libro. Todas las claves llevan el tipo delante (`spell:fireball|xphb`).
import { ABILITIES } from "../types";
import type {
  Ability, ActionData, ContainerData, ClassTable, Defenses, DefenseList, EntryData, EntryKind, Equipment, FeatSpellChoice, FeatSpellFilter, FeatureData, LevelCounts,
  LevelFeature, MulticlassData, ChoiceKind, NameGender, OptionalFeatureData, Pack, Ref, Spellcasting, SpellcastingProgression, SpellData, SpellGrant,
} from "../types";
import { normalizeName, validateEntryData } from "../schemas";
import { activationFor } from "./activation";
import { entriesToBbcode } from "./toBbcode";
import { ABILITY_NAMES, CHOICE_LABELS, FEAT_CATEGORIES, proficiencyName, skillName, toolName } from "../dnd2024/sheet/labels";
import { spellComponents, spellDuration, spellRange, spellTags, spellTime } from "../dnd2024/spells/spellText";
import { spellcastingMode } from "../dnd2024/spells/spellcastingModes";
import es from "../i18n/es.json";

export const BOOK_PLACEHOLDER = "__BOOK__";

export type NormalizedEntry = {
  kind: EntryKind;
  key: string;
  identifier: string;
  parent: { key: string } | null;
  name: string;
  description: string;
  srd52: boolean;
  /** Página en el libro (5etools); `null` si no consta. */
  page: number | null;
  data: EntryData[EntryKind];
};

type Rec = Record<string, unknown>;

/** JSON de 5etools ya leídos, agrupados por archivo. */
export type RawFiles = {
  bestiary?: { monster?: unknown[] }[];
  races?: { race?: unknown[] };
  backgrounds?: { background?: unknown[] };
  feats?: { feat?: unknown[] };
  items?: { item?: unknown[]; itemGroup?: unknown[] };
  itemsBase?: { baseitem?: unknown[] };
  languages?: { language?: unknown[] };
  skills?: { skill?: unknown[] };
  /** Un elemento por `spells/spells-*.json`. */
  spells?: { spell?: unknown[] }[];
  /** `spells/sources.json`: fuente → nombre del conjuro → clases que lo tienen. */
  spellSources?: Record<string, Record<string, { class?: { name: string; source: string }[] }>>;
  /** Un elemento por `class/class-*.json`. */
  classes?: { class?: unknown[]; subclass?: unknown[]; classFeature?: unknown[]; subclassFeature?: unknown[] }[];
  /** `optionalfeatures.json` (invocaciones, metamagia, maniobras…). */
  optionalFeatures?: { optionalfeature?: unknown[] };
  /** Un elemento por `class/fluff-class-*.json` (texto de presentación de cada clase). */
  classFluff?: { classFluff?: unknown[] }[];
  /** `names.json`: tablas de nombres por especie (Guía de Xanathar para todo). */
  names?: { name?: unknown[] };
  /** `actions.json`: acciones básicas de combate. */
  actions?: { action?: unknown[] };
};

/** Datos de contexto que necesitan algunos normalizadores. */
export type NormalizeContext = {
  /** Nombres de todas las habilidades (para "elige cualquiera"). */
  skillNames: string[];
  /** Clave del conjuro → identificadores de las clases que lo tienen en su lista (`wizard`). */
  spellClasses: Map<string, string[]>;
  /** `nombre corto|clase|fuente de la clase|fuente` en minúsculas → subclase. */
  subclasses: Map<string, { key: string; name: string }>;
  /** Clave de la clase → descripción (BBCode) sacada de su `fluff`. */
  classFluff: Map<string, string>;
};

// ---------- utilidades ----------

const isObj = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const clone = <T>(v: T): T => structuredClone(v);
const lower = (s: string) => s.toLowerCase();
const isAbility = (v: unknown): v is Ability => ABILITIES.includes(v as Ability);

/** `"Fireball"` → `fireball`, `"Explorer's Pack"` → `explorers-pack`. */
export function toIdentifier(name: string): string {
  return normalizeName(name)
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
}

/** Clave con el tipo delante y el resto estilo 5etools en minúsculas: `spell:fireball|xphb`. */
const prefixed = (kind: EntryKind, bare: string) => `${kind}:${lower(bare)}`;
const keyOf = (kind: EntryKind, name: string, source: string) => prefixed(kind, `${name}|${source}`);

/** Referencia del tipo `"dancing lights|xphb#c"` → clave sin sufijo `#…`. */
const cleanRefKey = (s: string) => lower(s.split("#")[0]);

const ref = (kind: EntryKind, bare: string): Ref => ({ book: BOOK_PLACEHOLDER, key: prefixed(kind, bare) });

/** Quita las etiquetas `{@tag texto|…}` dejando el texto visible. */
function plainText(s: string): string {
  let out = s;
  const innermost = /\{@(\w+)\s+([^{}]*)\}/;
  for (let guard = 0; guard < 1000; guard++) {
    const m = innermost.exec(out);
    if (!m) break;
    const parts = m[2].split("|");
    // En `{@filter texto|página|filtros…}` el texto visible es siempre el primero
    const shown = m[1] !== "filter" && parts.length >= 3 && parts[2] ? parts[2] : parts[0];
    out = out.slice(0, m.index) + shown + out.slice(m.index + m[0].length);
  }
  return out;
}

// ---------- herencias: _mod, _copy, _versions ----------

const nameOf = (v: unknown) => (isObj(v) ? str(v.name) : str(v));

function applyModOp(arr: unknown[], op: Rec): unknown[] {
  const items = asArr(op.items).map(clone);
  switch (op.mode) {
    case "replaceArr": {
      const target = op.replace;
      const i = isObj(target) && typeof target.index === "number"
        ? target.index
        : arr.findIndex((x) => nameOf(x) !== "" && nameOf(x) === str(target));
      if (i < 0) return arr;
      return [...arr.slice(0, i), ...items, ...arr.slice(i + 1)];
    }
    case "appendArr":
      return [...arr, ...items];
    case "prependArr":
      return [...items, ...arr];
    case "insertArr": {
      const i = typeof op.index === "number" ? op.index : arr.length;
      return [...arr.slice(0, i), ...items, ...arr.slice(i)];
    }
    case "removeArr": {
      const names = asArr(op.names).map(str);
      const removeItems = asArr(op.items).map((x) => JSON.stringify(x));
      return arr.filter((x) => !names.includes(nameOf(x)) && !removeItems.includes(JSON.stringify(x)));
    }
    default:
      return arr; // modos no usados en las fuentes importadas
  }
}

/** Aplica un `_mod` de 5etools (`{ propiedad: operación | operación[] }`) sobre `obj` (que se modifica). */
export function applyMod(obj: Rec, mod: unknown): Rec {
  if (!isObj(mod)) return obj;
  for (const [prop, ops] of Object.entries(mod)) {
    let arr = asArr(obj[prop]);
    for (const op of asArr(ops)) if (isObj(op)) arr = applyModOp(arr, op);
    obj[prop] = arr;
  }
  return obj;
}

// Campos de la base que no pasan a una copia (son propios de cada entrada en 5etools). `page` sí pasa si la copia es
// del mismo libro y no trae la suya
const NOT_COPIED = ["srd52", "basicRules2024", "_versions", "hasFluff", "hasFluffImages", "reprintedAs"];

/** Resuelve `_copy`: copia la base (buscada por `nombre|fuente` en `all`), encima los campos propios y aplica `_mod`. */
export function resolveCopy(raw: unknown, all: unknown[], depth = 0): unknown {
  if (!isObj(raw) || !isObj(raw._copy) || depth > 10) return raw;
  const { _copy: copy, ...own } = raw as Rec & { _copy: Rec };
  const base = all.find((x) => isObj(x)
    && lower(str(x.name)) === lower(str(copy.name)) && lower(str(x.source)) === lower(str(copy.source)));
  if (!base) throw new Error(`no se encuentra la base de _copy: ${str(copy.name)}|${str(copy.source)}`);
  const out = clone(resolveCopy(base, all, depth + 1)) as Rec;
  for (const k of NOT_COPIED) delete out[k];
  Object.assign(out, clone(own));
  // La página del original solo vale si la copia es del mismo libro
  if (own.page === undefined && lower(str(copy.source)) !== lower(str(own.source))) delete out.page;
  return applyMod(out, copy._mod);
}

/** Sustituye las variables `{{nombre}}` en todos los textos. */
function fillVariables(v: unknown, vars: Rec): unknown {
  if (typeof v === "string") return v.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  if (Array.isArray(v)) return v.map((x) => fillVariables(x, vars));
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillVariables(x, vars)]));
  return v;
}

/** Elementos que introduce un `_mod` (lo propio de la versión). Se guarda en `_versionEntries`. */
function modItems(mod: unknown, prop: string): unknown[] {
  if (!isObj(mod)) return [];
  return asArr(mod[prop]).flatMap((op) =>
    isObj(op) && op.mode !== "removeArr" ? asArr(op.items).map(clone) : []);
}

/**
 * Expande `_versions` (incluidas las abstractas con `_implementations` y `_variables`): cada versión es una copia
 * de la base con los campos de la versión encima y su `_mod` aplicado. El texto que añade la versión queda en
 * `_versionEntries` y el `_mod` original en `_versionMod`.
 */
export function expandVersions(base: unknown): Rec[] {
  if (!isObj(base)) return [];
  const specs: Rec[] = [];
  for (const v of asArr(base._versions)) {
    if (!isObj(v)) continue;
    if (isObj(v._abstract)) {
      for (const impl of asArr(v._implementations)) {
        if (!isObj(impl)) continue;
        const { _variables: vars, ...rest } = impl;
        specs.push(fillVariables({ ...clone(v._abstract), ...clone(rest) }, isObj(vars) ? vars : {}) as Rec);
      }
    } else specs.push(clone(v));
  }
  return specs.map((spec) => {
    const { _mod: mod, ...fields } = spec;
    const out = clone(base);
    delete out._versions;
    Object.assign(out, fields);
    applyMod(out, mod);
    out._versionEntries = modItems(mod, "entries");
    return out;
  });
}

// ---------- piezas comunes ----------

/**
 * `additionalSpells` → conjuros fijos por nivel de personaje/clase. Las elecciones (`choose`) se omiten. Con
 * `unleveled`, los que no tienen nivel (`"_"`, como los de las dotes) se dan en ese nivel. Si hay varios bloques con
 * nombre, son alternativas (las tierras del Círculo de la Tierra) y no se concede ninguno: ver `spellOptions`.
 */
function spellGrants(additional: unknown[], unleveled?: number): SpellGrant[] {
  return alternativeBlocks(additional) ? [] : blockGrants(additional, unleveled);
}

// Varios bloques con nombre: el personaje tiene uno solo de ellos (lo elige él)
const alternativeBlocks = (additional: unknown[]) =>
  additional.filter((b) => isObj(b) && typeof b.name === "string").length > 1;

/** Bloques alternativos con nombre (`Arid Land`, `Polar Land`…) con sus conjuros por nivel de clase. */
function spellOptions(additional: unknown[]): { name: string; spells: { level: number; ref: Ref }[] }[] {
  if (!alternativeBlocks(additional)) return [];
  return additional.filter(isObj).map((b) => ({
    name: str(b.name),
    spells: blockGrants([b]).map(({ level, ref: r }) => ({ level, ref: r })),
  }));
}

export function blockGrants(additional: unknown[], unleveled?: number): SpellGrant[] {
  const grants: SpellGrant[] = [];
  for (const block of additional) {
    if (!isObj(block)) continue;
    const ability = isObj(block.ability) ? undefined : block.ability;
    for (const group of ["known", "prepared", "innate", "expanded"]) {
      const byLevel = block[group];
      if (!isObj(byLevel)) continue;
      for (const [lvl, value] of Object.entries(byLevel)) {
        const level = lvl === "_" && unleveled !== undefined ? unleveled : Number(lvl);
        if (!Number.isInteger(level)) continue; // "_" = sin nivel, s1… = nivel de conjuro
        // Los de `daily.pb` se lanzan tantas veces por descanso largo como el bonificador de competencia
        const pb = group === "innate" && isObj(value) && isObj(value.daily) ? new Set(collectStrings(value.daily.pb)) : null;
        for (const s of collectStrings(value)) {
          grants.push({
            level, ref: ref("spell", cleanRefKey(s)), ...(isAbility(ability) ? { ability } : {}),
            ...(pb?.has(s) ? { uses: "pb" as const } : {}),
          });
        }
      }
    }
  }
  return grants.sort((a, b) => a.level - b.level);
}

/**
 * `additionalSpells` → conjuros a elegir (`{ choose: "level=1|class=Cleric", count }`) por nivel de personaje (los
 * que no tienen nivel, desde el 1); los filtros que no se entienden se omiten. Con varios bloques alternativos con
 * nombre (la dote base de Iniciado en la magia), solo si piden lo mismo salvo la lista de clase: entonces la lista se
 * elige (`lists`); si no, no se elige nada.
 */
function spellChoices(additional: unknown[]): FeatSpellChoice[] {
  if (!alternativeBlocks(additional)) return blockChoices(additional);
  const alternatives = additional.filter(isObj).map((b) => blockChoices([b]));
  const [first] = alternatives;
  const listOf = (c: FeatSpellChoice) => (c.filter.classes?.length === 1 ? c.filter.classes[0] : null);
  const same = (a: FeatSpellChoice, b: FeatSpellChoice) => a.level === b.level && a.count === b.count
    && JSON.stringify({ ...a.filter, classes: undefined }) === JSON.stringify({ ...b.filter, classes: undefined });
  // Cada alternativa, con una sola lista para todos sus conjuros
  const lists = alternatives.map((alt) => (new Set(alt.map(listOf)).size === 1 ? listOf(alt[0]) : null));
  const merged = first.length > 0 && lists.every(Boolean) && new Set(lists).size === lists.length
    && alternatives.every((alt) => alt.length === first.length && alt.every((c, i) => same(c, first[i])));
  if (!merged) return [];
  return first.map((c) => {
    const filter = { ...c.filter };
    delete filter.classes;
    return { level: c.level, count: c.count, filter, lists: lists as string[] };
  });
}

function blockChoices(additional: unknown[]): FeatSpellChoice[] {
  const out: FeatSpellChoice[] = [];
  const walk = (v: unknown, level: number): void => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, level));
    else if (isObj(v) && typeof v.choose === "string") {
      const filter = chooseFilter(v.choose);
      if (filter) out.push({ level, count: typeof v.count === "number" ? v.count : 1, filter });
    } else if (isObj(v)) Object.values(v).forEach((x) => walk(x, level));
  };
  for (const block of additional.filter(isObj)) {
    for (const group of ["known", "prepared", "innate", "expanded"]) {
      if (!isObj(block[group])) continue;
      for (const [lvl, value] of Object.entries(block[group] as Rec)) {
        const level = lvl === "_" ? 1 : Number(lvl);
        if (Number.isInteger(level) && level >= 1) walk(value, level);
      }
    }
  }
  return out.sort((a, b) => a.level - b.level);
}

// "level=1|class=Cleric;Druid", "level=1|school=E;D", "level=1|components & miscellaneous=ritual"
function chooseFilter(choose: string): FeatSpellFilter | null {
  const filter: Partial<FeatSpellFilter> = {};
  for (const part of choose.split("|")) {
    const [k, v = ""] = part.split("=").map((x) => x.trim());
    const key = lower(k);
    if (key === "level" && /^\d$/.test(v)) filter.level = Number(v);
    else if (key === "class") filter.classes = v.split(";").map((c) => toIdentifier(c));
    else if (key === "school") filter.schools = v.split(";").map((x) => x.toUpperCase());
    else if (key === "components & miscellaneous" && lower(v) === "ritual") filter.ritual = true;
    else return null;
  }
  return filter.level === undefined ? null : (filter as FeatSpellFilter);
}

// Los objetos con `choose` (elección del jugador) o `all` (lista ampliada por filtro), p. ej.
// `{ choose: "level=0;1|class=Wizard" }`, no son conjuros fijos y se omiten
const collectStrings = (v: unknown): string[] =>
  typeof v === "string" ? [v]
    : Array.isArray(v) ? v.flatMap(collectStrings)
      : isObj(v) && !("choose" in v) && !("all" in v) ? Object.values(v).flatMap(collectStrings) : [];

/** Código de 5etools (`setGaming`, `anyGamingSet`…) → texto en español; si no se conoce, el código. */
const choiceLabel = (code: string) => CHOICE_LABELS[code] ?? code;

/** Código de 5etools de un objeto a elegir → clase de objeto del catálogo (los canalizadores y demás, solo texto). */
const CHOICE_KINDS: Record<string, ChoiceKind> = {
  setGaming: "gaming", anyGamingSet: "gaming",
  instrumentMusical: "instrument", anyMusicalInstrument: "instrument",
  toolArtisan: "artisan", anyArtisansTool: "artisan",
  weaponSimple: "simple", weaponSimpleMelee: "simpleMelee",
  weaponMartial: "martial", weaponMartialMelee: "martialMelee",
};

/** Elemento de equipo inicial de 5etools → `Pack`. */
function toPack(p: unknown): Pack | null {
  if (typeof p === "string") return { ref: ref("item", cleanRefKey(p)) };
  if (!isObj(p)) return null;
  const pack: Pack = {};
  if (typeof p.item === "string") pack.ref = ref("item", cleanRefKey(p.item));
  if (typeof p.value === "number") pack.value = p.value;
  if (typeof p.quantity === "number") pack.quantity = p.quantity;
  const label = str(p.displayName) || str(p.special) || choiceLabel(str(p.equipmentType))
    || asArr(p.equipmentTypes).map((t, i) => {
      const l = choiceLabel(str(t));
      return i && l ? l[0].toLowerCase() + l.slice(1) : l; // "Un juego (a elegir) o un instrumento…"
    }).join(" o ");
  if (label) pack.displayName = label;
  // Solo se puede elegir del catálogo si todos los códigos se conocen
  const codes = p.equipmentType ? [str(p.equipmentType)] : asArr(p.equipmentTypes).map(str);
  const kinds = codes.map((c) => CHOICE_KINDS[c]);
  if (label && !p.displayName && !p.special && codes.length && kinds.every(Boolean)) pack.choose = { kinds, label };
  return Object.keys(pack).length ? pack : null;
}

/** Opciones de equipo inicial por letra ("A", "B", "C"…). */
function toEquipment(raw: unknown): Equipment {
  const opts = isObj(raw) ? raw : {};
  return Object.fromEntries(Object.entries(opts)
    // Algunos libros (Forja del Artífice) escriben las letras en minúscula
    .filter(([letter]) => /^[A-Za-z]$/.test(letter))
    .map(([letter, items]) => [letter.toUpperCase(), asArr(items).map(toPack).filter((x): x is Pack => x !== null)]));
}

/**
 * Equipo inicial de una clase. El formato de antes de 2024 (lista de elecciones sueltas, como el del artífice de Tasha) no
 * tiene opciones A/B: se ofrece solo el oro alternativo, con su media.
 */
function classEquipment(raw: unknown): Equipment {
  const start = isObj(raw) ? raw : {};
  const equipment = toEquipment(asArr(start.defaultData)[0]);
  if (Object.keys(equipment).length) return equipment;
  const dice = /(\d+)d(\d+) × (\d+)/.exec(str(start.goldAlternative));
  if (!dice) return equipment;
  const gold = Number(dice[1]) * ((Number(dice[2]) + 1) / 2) * Number(dice[3]);
  return { A: [{ value: gold * 100 }] } as unknown as Equipment;
}

/** `[{ a: true, b: true }]` → `["a", "b"]` (las claves `any…`/`choose` también se conservan como texto). */
const trueKeys = (v: unknown): string[] =>
  asArr(v).flatMap((o) => (isObj(o) ? Object.keys(o).filter((k) => k !== "choose") : typeof o === "string" ? [o] : []));

/** Página de 5etools: solo un entero positivo; si no, `null`. */
const pageOf = (raw: Rec): number | null =>
  typeof raw.page === "number" && Number.isInteger(raw.page) && raw.page > 0 ? raw.page : null;

function header(kind: EntryKind, raw: Rec, key: string, extra: Partial<NormalizedEntry> = {}): Omit<NormalizedEntry, "data"> {
  const name = str(raw.name);
  return {
    kind,
    key,
    identifier: toIdentifier(name),
    parent: null,
    name,
    description: entriesToBbcode(asArr(raw.entries)),
    srd52: Boolean(raw.srd52),
    page: pageOf(raw),
    ...extra,
  };
}

const entry = <K extends EntryKind>(head: Omit<NormalizedEntry, "data">, data: EntryData[K]): NormalizedEntry =>
  ({ ...head, data });

// ---------- normalizadores por tipo ----------

const DEFENSE_FIELDS = ["resist", "immune", "vulnerable", "conditionImmune"] as const;

/** Resistencias, inmunidades, vulnerabilidades y estados inmunes; se descartan las condicionales (`special`, `cond`, listas anidadas). */
export function normalizeDefenses(raw: Rec): Defenses | undefined {
  const out: Defenses = {};
  for (const field of DEFENSE_FIELDS) {
    const list: DefenseList = [];
    for (const v of asArr(raw[field])) {
      if (typeof v === "string") list.push(lower(v));
      else if (isObj(v) && isObj(v.choose) && v.special === undefined && v.cond === undefined) {
        const from = asArr(v.choose.from).map((x) => lower(str(x))).filter(Boolean);
        if (from.length) list.push({ choose: { from, count: typeof v.choose.count === "number" ? v.choose.count : 1 } });
      }
    }
    if (list.length) out[field] = list;
  }
  return Object.keys(out).length ? out : undefined;
}

/** `{ defenses }` para añadir a los datos, o nada. */
const withDefenses = (raw: Rec): { defenses?: Defenses } => {
  const defenses = normalizeDefenses(raw);
  return defenses ? { defenses } : {};
};

export function normalizeSpecies(raw: Rec, ctx: NormalizeContext): NormalizedEntry {
  const skillBlock = asArr(raw.skillProficiencies)[0];
  const skills: { fixed: string[]; choose?: { count: number; from: string[] } } = { fixed: [] };
  if (isObj(skillBlock)) {
    skills.fixed = Object.keys(skillBlock).filter((k) => skillBlock[k] === true);
    if (isObj(skillBlock.choose)) {
      const c = skillBlock.choose;
      skills.choose = { count: typeof c.count === "number" ? c.count : 1, from: asArr(c.from).map(str) };
    } else if (typeof skillBlock.any === "number") {
      skills.choose = { count: skillBlock.any, from: ctx.skillNames };
    }
  }
  const speed = walkSpeed(raw.speed);
  // Los conjuros con nombre pertenecen a un legado; las especies 2024 no tienen aumentos de característica
  const ownSpells = asArr(raw.additionalSpells).filter((b) => isObj(b) && b.name === undefined);
  return entry<"species">(header("species", raw, keyOf("species", str(raw.name), str(raw.source))), {
    size: asArr(raw.size).map(str) as ("S" | "M" | "L")[],
    speed: speed ?? 30,
    darkvision: typeof raw.darkvision === "number" ? raw.darkvision : 0,
    creatureType: str(asArr(raw.creatureTypes)[0]) || "humanoid",
    skills,
    spells: spellGrants(ownSpells),
    hasLineages: asArr(raw._versions).length > 0,
    ...(asArr(raw.traitTags).includes("Natural Armor") ? { naturalArmor: true } : {}),
    ...withDefenses(raw),
  });
}

const walkSpeed = (v: unknown): number | undefined => {
  const walk = isObj(v) ? v.walk : v;
  return typeof walk === "number" ? walk : undefined;
};

/** Nombre del legado: `"Elf; Drow Lineage"` → `Drow`. */
const lineageName = (versionName: string) =>
  (versionName.includes(";") ? versionName.split(";").slice(1).join(";") : versionName).replace(/\s+Lineage$/i, "").trim();

/** `version` es una de las devueltas por `expandVersions(especie)`. */
export function normalizeLineage(version: Rec, species: Rec): NormalizedEntry {
  const name = lineageName(str(version.name));
  const own = asArr(version._versionEntries);
  const data: EntryData["lineage"] = {
    spells: spellGrants(asArr(version.additionalSpells).filter((b) => isObj(b) && b.name === undefined)),
    traitName: nameOf(own[0]) || name,
    ...withDefenses(version),
  };
  if (typeof version.darkvision === "number" && version.darkvision !== species.darkvision) data.darkvision = version.darkvision;
  const speed = walkSpeed(version.speed);
  if (speed !== undefined && speed !== walkSpeed(species.speed)) data.speed = speed;
  return entry<"lineage">({
    kind: "lineage",
    key: keyOf("lineage", name, str(version.source)),
    identifier: toIdentifier(name),
    parent: { key: keyOf("species", str(species.name), str(species.source)) },
    name,
    description: entriesToBbcode(own),
    srd52: Boolean(species.srd52),
    page: pageOf(species),
  }, data);
}

export function normalizeBackground(raw: Rec): NormalizedEntry {
  const abilityBlock = asArr(raw.ability)[0];
  const weighted = isObj(abilityBlock) && isObj(abilityBlock.choose) && isObj(abilityBlock.choose.weighted)
    ? abilityBlock.choose.weighted : {};
  const featKey = Object.keys(asArr(raw.feats)[0] ?? {})[0] ?? "";
  return entry<"background">(header("background", raw, keyOf("background", str(raw.name), str(raw.source))), {
    abilities: asArr(weighted.from).map(str) as Ability[],
    feat: ref("feat", featKey),
    skills: trueKeys(raw.skillProficiencies),
    tools: trueKeys(raw.toolProficiencies),
    equipment: toEquipment(asArr(raw.startingEquipment)[0]),
  });
}

/** Texto breve en inglés de los requisitos de una dote (se traducirá con el diccionario). */
function prerequisiteText(pre: unknown): string | undefined {
  const parts = asArr(pre).map((p) => {
    if (!isObj(p)) return "";
    const bits: string[] = [];
    if (typeof p.level === "number") bits.push(`Level ${p.level}+`);
    for (const a of asArr(p.ability)) {
      if (isObj(a)) bits.push(Object.entries(a).map(([k, v]) => `${k.toUpperCase()} ${String(v)}+`).join(" or "));
    }
    for (const f of asArr(p.feature)) bits.push(plainText(str(f)));
    if (p.spellcasting2020 || p.spellcasting) bits.push("Spellcasting");
    for (const pr of asArr(p.proficiency)) {
      if (isObj(pr)) bits.push(Object.entries(pr).map(([k, v]) => `${String(v)} ${k}`).join(", "));
    }
    if (isObj(p.otherSummary)) bits.push(plainText(str(p.otherSummary.entry)));
    return bits.join(", ");
  }).filter(Boolean);
  return parts.length ? parts.join("; or ") : undefined;
}

export function normalizeFeat(raw: Rec): NormalizedEntry {
  const data: EntryData["feat"] = {
    // Sin categoría (libros anteriores a 2024) o con una propia de su libro (marcas de dragón de Eberron): generales
    category: (FEAT_CATEGORIES[str(raw.category)] ?? "general") as EntryData["feat"]["category"],
    ...(str(raw.category) ? { categoryCode: str(raw.category) } : {}),
    repeatable: raw.repeatable === true,
    ...withDefenses(raw),
  };
  const prerequisite = prerequisiteText(raw.prerequisite);
  if (prerequisite) data.prerequisite = prerequisite;
  const increase = new Set<Ability>();
  for (const a of asArr(raw.ability)) {
    if (!isObj(a)) continue;
    const from = isObj(a.choose) ? asArr(a.choose.from) : Object.keys(a);
    from.filter(isAbility).forEach((x) => increase.add(x));
  }
  if (increase.size) data.abilityIncrease = ABILITIES.filter((x) => increase.has(x));
  // Conjuros: los fijos desde que se obtiene la dote; los elegidos solo marcan que da conjuros
  const additional = asArr(raw.additionalSpells);
  const spells = spellGrants(additional, 1);
  if (spells.length) data.spells = spells;
  if (additional.length) data.grantsSpells = true;
  const choices = spellChoices(additional);
  if (choices.length) data.spellChoices = choices;
  // Característica elegible: la misma en todos los bloques (alternativos o no)
  const chooses = additional.map((b) => (isObj(b) && isObj(b.ability) ? b.ability.choose : null));
  const choose = chooses[0];
  if (choices.length && Array.isArray(choose) && choose.every(isAbility)
    && chooses.every((c) => JSON.stringify(c) === JSON.stringify(choose))) data.spellAbility = choose;
  return entry<"feat">(header("feat", raw, keyOf("feat", str(raw.name), str(raw.source))), data);
}

/** Daño del conjuro: la tabla `scalingLevelDice` (trucos) o, si no la hay, el primer `{@damage …}` del texto. */
function spellDamage(raw: Rec): SpellData["damage"] {
  const sld = asArr(raw.scalingLevelDice).length ? asArr(raw.scalingLevelDice)[0] : raw.scalingLevelDice;
  if (isObj(sld) && isObj(sld.scaling)) {
    const scaling = Object.entries(sld.scaling)
      .flatMap(([level, dice]) => (typeof dice === "string" ? [{ level: Number(level), dice }] : []))
      .sort((a, b) => a.level - b.level);
    if (scaling.length) return { dice: scaling[0].dice, scaling };
  }
  const m = /\{@damage\s+([^}|]+)/.exec(JSON.stringify([raw.entries]));
  return m ? { dice: m[1].trim() } : undefined;
}

/** Dados de curación: el primer `{@dice …}` tras «regains»/«restore»; sin curación si el texto tiene daño. */
export function spellHealing(raw: Rec): SpellData["healing"] {
  const text = JSON.stringify([raw.entries]);
  if (text.includes("{@damage")) return undefined;
  const m = /\b(?:regains?|restore)\b[^."]*\{@dice\s+([^}|]+)/.exec(text);
  return m ? { dice: m[1].trim() } : undefined;
}

export function normalizeSpell(raw: Rec, ctx: NormalizeContext): NormalizedEntry {
  const key = keyOf("spell", str(raw.name), str(raw.source));
  const head = header("spell", raw, key);
  head.description = entriesToBbcode([...asArr(raw.entries), ...asArr(raw.entriesHigherLevel)]);
  const meta = isObj(raw.meta) ? raw.meta : {};
  // La mejora va sin su título («Using a Higher-Level Spell Slot»)
  const higherLevels = entriesToBbcode(asArr(raw.entriesHigherLevel).flatMap((e) => (isObj(e) ? asArr(e.entries) : [e])));
  const damage = spellDamage(raw);
  const healing = spellHealing(raw);
  return entry<"spell">(head, {
    level: raw.level as number,
    school: str(raw.school),
    time: spellTime(raw.time),
    range: spellRange(raw.range),
    components: spellComponents(raw.components),
    duration: spellDuration(raw.duration),
    concentration: asArr(raw.duration).some((d) => isObj(d) && d.concentration === true),
    ritual: meta.ritual === true,
    classes: ctx.spellClasses.get(key) ?? [],
    tags: spellTags(raw),
    ...(higherLevels ? { higherLevels } : {}),
    ...(damage ? { damage } : {}),
    ...(healing ? { healing } : {}),
  });
}

const stripSource = (s: string) => s.split("|")[0];
const ARMOR: Record<string, { category: string; dexCap: number | null }> = {
  LA: { category: "light", dexCap: null },
  MA: { category: "medium", dexCap: 2 },
  HA: { category: "heavy", dexCap: 0 },
  S: { category: "shield", dexCap: null },
};

/** `containerCapacity` de 5etools → capacidad; sin peso, sin objetos y con volumen < 1 pie cúbico (frascos) no es un contenedor. */
function containerOf(raw: unknown): ContainerData | null {
  if (!isObj(raw)) return null;
  const sum = (v: unknown) => asArr(v).reduce<number>((t, n) => t + (typeof n === "number" ? n : 0), 0);
  const weight = sum(raw.weight) || null;
  const volumeSum = sum(raw.volume);
  const volume = volumeSum >= 1 ? volumeSum : null;
  const items = asArr(raw.item).flatMap((o) => isObj(o)
    ? Object.entries(o).flatMap(([key, count]) => typeof count === "number" ? [{ ref: ref("item", cleanRefKey(key)), count }] : [])
    : []);
  if (weight === null && volume === null && !items.length) return null;
  return { weight, volume, items, weightless: raw.weightless === true };
}

export function normalizeItem(raw: Rec): NormalizedEntry {
  const type = stripSource(str(raw.type)) || "OTH";
  const data: EntryData["item"] = {
    type,
    weight: typeof raw.weight === "number" ? raw.weight : 0,
    value: typeof raw.value === "number" ? raw.value : 0,
    ...withDefenses(raw),
  };
  if (str(raw.rarity) && raw.rarity !== "none") data.rarity = str(raw.rarity);
  if (type in ARMOR && typeof raw.ac === "number") {
    data.armor = { ac: raw.ac, ...ARMOR[type], stealthDisadvantage: raw.stealth === true };
  }
  if (raw.weapon === true || typeof raw.dmg1 === "string") {
    const mastery = asArr(raw.mastery).map((m) => lower(stripSource(str(m))))[0];
    data.weapon = {
      damage: str(raw.dmg1),
      damageType: str(raw.dmgType),
      properties: asArr(raw.property).map((p) => stripSource(isObj(p) ? str(p.uid) : str(p))),
      ...(mastery ? { mastery } : {}),
      category: str(raw.weaponCategory),
      ...(str(raw.range) ? { range: str(raw.range) } : {}),
    };
  }
  if (Array.isArray(raw.packContents)) {
    data.contents = raw.packContents.flatMap((c) => {
      const p = toPack(c);
      return p?.ref ? [{ ref: p.ref, quantity: p.quantity ?? 1 }] : [];
    });
  }
  const container = containerOf(raw.containerCapacity);
  if (container) data.container = container;
  return entry<"item">(header("item", raw, keyOf("item", str(raw.name), str(raw.source))), data);
}

// Lista de defensas de 5etools («fire», o { immune: ["poison"], note }) en texto plano
const defenseList = (v: unknown, field: string): string[] => asArr(v).flatMap((x) => {
  if (typeof x === "string") return [x];
  if (!isObj(x)) return [];
  if (typeof x.special === "string") return [x.special];
  return defenseList(x[field], field);
});
const monsterBlocks = (v: unknown) => asArr(v).flatMap((b) => (isObj(b) ? [{ name: str(b.name), text: entriesToBbcode(asArr(b.entries)) }] : []));
const stringMap = (v: unknown) => (isObj(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === "string")) as Record<string, string> : {});

export function normalizeMonster(raw: Rec): NormalizedEntry {
  const type = isObj(raw.type) ? raw.type : { type: raw.type };
  const ac = asArr(raw.ac)[0];
  const hp = isObj(raw.hp) ? raw.hp : {};
  const speed = Object.fromEntries(Object.entries(isObj(raw.speed) ? raw.speed : {}).flatMap(([k, v]) => {
    if (typeof v === "number") return [[k, v]];
    return isObj(v) && typeof v.number === "number" ? [[k, v.number]] : [];
  }));
  const score = (a: string) => (typeof raw[a] === "number" ? (raw[a] as number) : 0);
  const data: EntryData["monster"] = {
    size: asArr(raw.size).map(str),
    type: isObj(type.type) ? asArr(type.type.choose).map(str).join("/") : str(type.type),
    tags: asArr(type.tags).map((t) => (isObj(t) ? str(t.tag) : str(t))),
    alignment: asArr(raw.alignment).flatMap((a) => (typeof a === "string" ? [a] : [])),
    ac: typeof ac === "number" ? ac : isObj(ac) && typeof ac.ac === "number" ? ac.ac : 0,
    acNote: isObj(ac) ? (typeof ac.special === "string" ? ac.special : asArr(ac.from).map(str).join(", ")) : "",
    hp: typeof hp.average === "number" ? hp.average : 0,
    hpFormula: typeof hp.formula === "string" ? hp.formula : typeof hp.special === "string" ? hp.special : "",
    speed,
    abilities: { str: score("str"), dex: score("dex"), con: score("con"), int: score("int"), wis: score("wis"), cha: score("cha") },
    saves: stringMap(raw.save),
    skills: stringMap(raw.skill),
    senses: asArr(raw.senses).map(str),
    passive: typeof raw.passive === "number" ? raw.passive : 0,
    languages: asArr(raw.languages).map(str),
    cr: isObj(raw.cr) ? str(raw.cr.cr) : str(raw.cr),
    resist: defenseList(raw.resist, "resist"),
    immune: defenseList(raw.immune, "immune"),
    vulnerable: defenseList(raw.vulnerable, "vulnerable"),
    conditionImmune: defenseList(raw.conditionImmune, "conditionImmune"),
    traits: monsterBlocks(raw.trait),
    actions: monsterBlocks(raw.action),
    bonus: monsterBlocks(raw.bonus),
    reactions: monsterBlocks(raw.reaction),
    legendary: monsterBlocks(raw.legendary),
    environment: asArr(raw.environment).map(str),
  };
  return entry<"monster">(header("monster", raw, keyOf("monster", str(raw.name), str(raw.source))), data);
}

export function normalizeLanguage(raw: Rec): NormalizedEntry {
  return entry<"language">(header("language", raw, keyOf("language", str(raw.name), str(raw.source))),
    // Los libros anteriores a 2024 dicen «exotic» o «secret», o no dicen nada: todo eso es lo que ahora se llama rara
    { type: raw.type === "standard" ? "standard" : "rare" });
}

export function normalizeSkill(raw: Rec): NormalizedEntry {
  return entry<"skill">(header("skill", raw, keyOf("skill", str(raw.name), str(raw.source))), { ability: raw.ability as Ability });
}

// Tiempo de 5etools (`[{ number, unit }]`, `["Free"]`, `["Varies"]`): el primero; `varies` si no se reconoce
export function normalizeAction(raw: Rec): NormalizedEntry {
  const t = asArr(raw.time)[0];
  const unit = isObj(t) ? str(t.unit) : lower(str(t));
  const time: ActionData["time"] = unit === "action" || unit === "bonus" || unit === "reaction" || unit === "free" ? unit : "varies";
  return entry<"action">(header("action", raw, keyOf("action", str(raw.name), str(raw.source))), { time });
}

/** Referencia de rasgo `"Rage|Barbarian|XPHB|1"` (o `{ classFeature: … }`) → clave y nivel. */
function featureRef(f: unknown, field: "classFeature" | "subclassFeature"): LevelFeature | null {
  const s = typeof f === "string" ? f : isObj(f) ? str(f[field]) : "";
  if (!s) return null;
  const parts = s.split("|");
  const level = Number(parts[parts.length - 1]);
  return Number.isInteger(level) ? { ref: ref(field, s), level } : null;
}

// `artificer` es medio lanzador redondeando hacia arriba (Paladín y Explorador de 2024)
const PROGRESSION: Record<string, SpellcastingProgression> = {
  full: "full", "1/2": "half", artificer: "half", "1/3": "third", pact: "pact",
};

/** Lanzamiento de una clase o subclase; sin característica o con una progresión desconocida, no lanza conjuros. */
function spellcasting(raw: Rec, key: string): Spellcasting | null {
  const ability = raw.spellcastingAbility;
  const progression = PROGRESSION[str(raw.casterProgression)];
  return isAbility(ability) && progression ? { ability, progression, mode: spellcastingMode(key, raw) } : null;
}

/** Resumen en español de una clase sin descripción propia ni `fluff`: dado de golpe, competencias y rasgos de nivel 1. */
function classSummary(raw: Rec, data: EntryData["class"], anySkills: boolean): string {
  const list = (xs: string[]) => xs.join(", ") || "—";
  // [{ str: true }, { dex: true }] → "Fuerza o Destreza"; [{ dex: true, wis: true }] → "Destreza y Sabiduría"
  const primary = asArr(raw.primaryAbility)
    .map((p) => (isObj(p) ? ABILITIES.filter((a) => p[a] === true).map((a) => ABILITY_NAMES[a]).join(" y ") : ""))
    .filter(Boolean)
    .join(" o ");
  const skills = anySkills
    ? `elige ${data.skills.count} cualesquiera`
    : `elige ${data.skills.count} entre ${data.skills.from.map(skillName).join(", ")}`;
  // "Rage|Barbarian|XPHB|1" → "Rage" (los rasgos aún no tienen traducción)
  const level1 = asArr(raw.classFeatures)
    .map((f) => (typeof f === "string" ? f : isObj(f) ? str(f.classFeature) : "").split("|"))
    .filter((parts) => parts[parts.length - 1] === "1")
    .map((parts) => plainText(parts[0]));
  const lines: [string, string][] = [
    ["Dado de golpe", `d${data.hitDie}`],
    ["Característica principal", primary || "—"],
    ["Salvaciones", list(data.saves.map((a) => ABILITY_NAMES[a]))],
    ["Habilidades", skills],
    ["Armaduras", list(data.armor.map(proficiencyName))],
    ["Armas", list(data.weapons.map(proficiencyName))],
    ["Herramientas", list(data.tools.map(toolName))],
    ["Rasgos de nivel 1", list(level1)],
  ];
  return lines.map(([k, v]) => `[b]${k}:[/b] ${v}`).join("\n");
}

/** Progresión de 5etools (`{ "2": 2, "10": 4 }` o lista de 20 valores) → acumulado solo en los niveles en que cambia. */
function levelCounts(progression: unknown): LevelCounts {
  const out: LevelCounts = {};
  if (Array.isArray(progression)) {
    let previous = 0;
    progression.forEach((n, i) => {
      if (typeof n === "number" && n !== previous) out[i + 1] = previous = n;
    });
  } else if (isObj(progression)) {
    for (const [level, n] of Object.entries(progression)) if (typeof n === "number") out[Number(level)] = n;
  }
  return out;
}

const perLevel = (v: unknown): number[] | null =>
  Array.isArray(v) && v.length ? v.map((n) => (typeof n === "number" ? n : 0)) : null;

/** Dotes y rasgos opcionales por nivel (de una clase o de una subclase). */
function choiceProgressions(raw: Rec): EntryData["subclass"]["progressions"] {
  return {
    feats: asArr(raw.featProgression).filter(isObj)
      .map((p) => ({ category: asArr(p.category).map(str), levels: levelCounts(p.progression) })),
    optionalFeatures: asArr(raw.optionalfeatureProgression).filter(isObj).map((p) => ({
      name: str(p.name), featureType: asArr(p.featureType).map(str), levels: levelCounts(p.progression),
    })),
  };
}

function classProgressions(raw: Rec): EntryData["class"]["progressions"] {
  return {
    ...choiceProgressions(raw),
    weaponMastery: isObj(raw.itemMasteriesProgression) ? levelCounts(raw.itemMasteriesProgression) : null,
    cantrips: perLevel(raw.cantripProgression),
    prepared: perLevel(raw.preparedSpellsProgression),
    spellbook: perLevel(raw.spellsKnownProgressionFixed),
  };
}

// Columnas de las tablas de clase del Manual del Jugador 2024
const TABLE_LABELS: Record<string, string> = {
  Rages: "Furias",
  "Rage Damage": "Daño de furia",
  "Weapon Mastery": "Maestría con armas",
  "Bardic Die": "Dado de inspiración bárdica",
  Cantrips: "Trucos",
  "Prepared Spells": "Conjuros preparados",
  "Channel Divinity": "Canalizar divinidad",
  "Wild Shape": "Forma salvaje",
  "Second Wind": "Nuevas energías",
  "Martial Arts": "Artes marciales",
  "Focus Points": "Puntos de concentración",
  "Unarmored Movement": "Movimiento sin armadura",
  "Favored Enemy": "Enemigo predilecto",
  "Sneak Attack": "Ataque furtivo",
  "Sorcery Points": "Puntos de hechicería",
  Invocations: "Invocaciones",
  "Spell Slots": "Espacios de conjuro",
  "Slot Level": "Nivel de espacio",
};

/**
 * Celda de la tabla de clase → texto: `{ type: "bonus", value: 2 }` → «+2», dados → «1d6», 0 → «—» (como el libro).
 * Quien lea los valores como números debe tratar «—» como 0.
 */
function tableCell(v: unknown): string {
  if (typeof v === "number") return v === 0 ? "—" : String(v);
  if (typeof v === "string") return plainText(v);
  if (!isObj(v)) return "";
  const value = typeof v.value === "number" ? v.value : 0;
  const signed = (unit: string) => (value === 0 ? "—" : `${value > 0 ? "+" : ""}${value}${unit}`);
  switch (v.type) {
    case "dice":
      return asArr(v.toRoll).filter(isObj)
        .map((d) => `${typeof d.number === "number" ? d.number : 1}d${String(d.faces)}`).join(" + ");
    case "bonus": return signed("");
    case "bonusSpeed": return signed(" pies");
    default: return typeof v.value === "number" ? String(v.value) : "";
  }
}

/** `classTableGroups` → columnas con 20 valores (los espacios de conjuro, una columna por nivel de conjuro). */
function classTable(groups: unknown): ClassTable {
  const columns: ClassTable["columns"] = [];
  for (const g of asArr(groups)) {
    if (!isObj(g)) continue;
    const slots = Array.isArray(g.rowsSpellProgression);
    const rows = asArr(slots ? g.rowsSpellProgression : g.rows);
    asArr(g.colLabels).forEach((l, i) => {
      const label = plainText(str(l));
      columns.push({
        id: slots ? `slots-${i + 1}` : label.trim().toLowerCase().replace(/\s+/g, "-"),
        label: slots ? `Espacios de nivel ${i + 1}` : TABLE_LABELS[label] ?? label,
        values: Array.from({ length: 20 }, (_, level) => {
          const row = rows[level];
          return Array.isArray(row) ? tableCell(row[i]) : "";
        }),
      });
    });
  }
  return { columns };
}

/** Requisitos (13+ en la característica principal) y competencias al entrar en la clase como multiclase. */
function multiclassData(raw: Rec, ctx: NormalizeContext): MulticlassData {
  // `[{ str: true }, { dex: true }]` → Fuerza o Destreza; `[{ dex: true, wis: true }]` → las dos
  const primary = asArr(raw.primaryAbility).filter(isObj);
  const multi = isObj(raw.multiclassing) ? raw.multiclassing : {};
  const gained = isObj(multi.proficienciesGained) ? multi.proficienciesGained : {};
  const skillBlock = asArr(gained.skills)[0];
  let skills: MulticlassData["proficiencies"]["skills"] = null;
  if (isObj(skillBlock) && isObj(skillBlock.choose)) {
    skills = {
      count: typeof skillBlock.choose.count === "number" ? skillBlock.choose.count : 1,
      from: asArr(skillBlock.choose.from).map(str),
    };
  } else if (isObj(skillBlock) && typeof skillBlock.any === "number") {
    skills = { count: skillBlock.any, from: ctx.skillNames };
  }
  const texts = (v: unknown) => asArr(v).map((x) => plainText(str(x)));
  return {
    requirements: {
      abilities: ABILITIES.filter((a) => primary.some((p) => p[a] === true)),
      any: primary.length > 1,
    },
    proficiencies: { armor: texts(gained.armor), weapons: texts(gained.weapons), tools: texts(gained.tools), skills },
  };
}

// Conjuros de `additionalSpells` de una clase que no están siempre preparados: el Druida lanza Encontrar familiar con
// Compañero salvaje (gastando Forma salvaje), sin tenerlo preparado
const NOT_ALWAYS_PREPARED: Record<string, string[]> = {
  "class:druid|xphb": ["spell:find familiar|xphb"],
};

/** Título de subclase en español (`subclassTitle:barbarian|xphb` en el diccionario); si no está, el original. */
const subclassTitle = (raw: Rec) =>
  (es as Record<string, string>)[`subclassTitle:${lower(`${str(raw.name)}|${str(raw.source)}`)}`] ?? str(raw.subclassTitle);

export function normalizeClass(raw: Rec, ctx: NormalizeContext): NormalizedEntry {
  const prof = isObj(raw.startingProficiencies) ? raw.startingProficiencies : {};
  const skillBlock = asArr(prof.skills)[0];
  const skills = { count: 0, from: [] as string[] };
  if (isObj(skillBlock) && isObj(skillBlock.choose)) {
    skills.count = typeof skillBlock.choose.count === "number" ? skillBlock.choose.count : 1;
    skills.from = asArr(skillBlock.choose.from).map(str);
  } else if (isObj(skillBlock) && typeof skillBlock.any === "number") {
    skills.count = skillBlock.any;
    skills.from = ctx.skillNames;
  }
  const rawFeatures = asArr(raw.classFeatures);
  const features = rawFeatures.map((f) => featureRef(f, "classFeature")).filter((x): x is LevelFeature => x !== null);
  const subclassAt = rawFeatures.map((f) => (isObj(f) && f.gainSubclassFeature ? featureRef(f, "classFeature") : null))
    .find((x) => x !== null);
  const hd = isObj(raw.hd) ? raw.hd.faces : undefined;
  const key = keyOf("class", str(raw.name), str(raw.source));
  const data: EntryData["class"] = {
    hitDie: hd as EntryData["class"]["hitDie"],
    primaryAbility: ABILITIES.filter((a) => asArr(raw.primaryAbility).some((p) => isObj(p) && p[a] === true)),
    saves: asArr(raw.proficiency).map(str) as Ability[],
    armor: asArr(prof.armor).map((a) => plainText(str(a))),
    weapons: asArr(prof.weapons).map((w) => plainText(str(w))).filter(Boolean),
    tools: asArr(prof.tools).map((t) => plainText(str(t))),
    skills,
    equipment: classEquipment(raw.startingEquipment),
    subclassLevel: subclassAt?.level ?? 3,
    asiLevels: features.filter((f) => f.ref.key.startsWith("classFeature:ability score improvement|")).map((f) => f.level),
    spellcasting: spellcasting(raw, key),
    spells: spellGrants(asArr(raw.additionalSpells)).map(({ level, ref: r }) => ({ level, ref: r }))
      .filter((s) => !NOT_ALWAYS_PREPARED[key]?.includes(s.ref.key)),
    features,
    progressions: classProgressions(raw),
    table: classTable(raw.classTableGroups),
    multiclass: multiclassData(raw, ctx),
    subclassTitle: subclassTitle(raw),
  };
  // Descripción: la propia, si no la del `fluff` y, si tampoco hay, un resumen hecho con los datos
  const head = header("class", raw, key);
  head.description ||= ctx.classFluff.get(key) || classSummary(raw, data, isObj(skillBlock) && typeof skillBlock.any === "number");
  return entry<"class">(head, data);
}

/** Clave de subclase: `subclass:nombre|clase|fuente de la clase` (+ `|fuente` si es otra). */
const subclassKey = (raw: Rec) => {
  const k = `${str(raw.name)}|${str(raw.className)}|${str(raw.classSource)}`;
  return prefixed("subclass", lower(str(raw.source)) === lower(str(raw.classSource)) ? k : `${k}|${str(raw.source)}`);
};
const subclassLookup = (shortName: string, className: string, classSource: string, source: string) =>
  lower(`${shortName}|${className}|${classSource}|${source}`);

export function normalizeSubclass(raw: Rec): NormalizedEntry {
  const key = subclassKey(raw);
  const casting = spellcasting(raw, key);
  const progressions: EntryData["subclass"]["progressions"] = choiceProgressions(raw);
  // Subclases lanzadoras (Caballero arcano, Embaucador arcano): trucos y preparados propios
  if (casting) {
    progressions.cantrips = perLevel(raw.cantripProgression);
    progressions.prepared = perLevel(raw.preparedSpellsProgression);
  }
  const options = spellOptions(asArr(raw.additionalSpells));
  return entry<"subclass">(header("subclass", raw, key, {
    parent: { key: keyOf("class", str(raw.className), str(raw.classSource)) },
  }), {
    features: asArr(raw.subclassFeatures).map((f) => featureRef(f, "subclassFeature"))
      .filter((x): x is LevelFeature => x !== null),
    spells: spellGrants(asArr(raw.additionalSpells)).map(({ level, ref: r }) => ({ level, ref: r })),
    ...(options.length ? { spellOptions: options } : {}),
    progressions,
    ...(casting ? { spellcasting: casting } : {}),
  });
}

/** Clave de rasgo de clase: `classFeature:nombre|clase|fuente de la clase|nivel` (+ `|fuente` si es otra). */
const classFeatureKey = (name: string, className: string, classSource: string, level: string, source: string) => {
  const sourceSuffix = !source || lower(source) === lower(classSource) ? "" : `|${source}`;
  return prefixed("classFeature", `${name}|${className}|${classSource}|${level}${sourceSuffix}`);
};

/** Clave de rasgo de subclase: `subclassFeature:nombre|clase|fuente|subclase|fuente de la subclase|nivel` (+ `|fuente`). */
const subclassFeatureKey = (parts: string[], source: string) => {
  const sourceSuffix = !source || lower(source) === lower(parts[4]) ? "" : `|${source}`;
  return prefixed("subclassFeature", parts.join("|") + sourceSuffix);
};

/**
 * Elemento de un bloque `options`: `refClassFeature` (`"Protector|Cleric|XPHB|1|XPHB"`), `refSubclassFeature`
 * (`"Nombre|Clase|XPHB|Subclase|XPHB|3"`) o `refOptionalfeature`.
 */
function optionRef(o: unknown): Ref | null {
  if (!isObj(o)) return null;
  if (o.type === "refClassFeature") {
    const [name, className, classSource, level, source] = str(o.classFeature).split("|");
    return level ? { book: BOOK_PLACEHOLDER, key: classFeatureKey(name, className, classSource, level, source ?? "") } : null;
  }
  if (o.type === "refSubclassFeature") {
    const parts = str(o.subclassFeature).split("|");
    return parts.length >= 6 ? { book: BOOK_PLACEHOLDER, key: subclassFeatureKey(parts.slice(0, 6), parts[6] ?? "") } : null;
  }
  if (o.type === "refOptionalfeature" && str(o.optionalfeature)) return ref("optionalFeature", cleanRefKey(str(o.optionalfeature)));
  return null;
}

/** Datos comunes de los rasgos: opciones entre las que elegir (bloques `options`) y mejora de característica. */
function featureExtras(raw: Rec): Pick<FeatureData, "options" | "asi"> {
  const options: Ref[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (isObj(v) && v.type === "options") {
      for (const o of asArr(v.entries)) {
        const r = optionRef(o);
        if (r) options.push(r);
      }
    } else if (isObj(v)) {
      walk(v.entries);
      walk(v.items); // listas (`type: "list"`) con bloques dentro
    }
  };
  walk(raw.entries);
  return {
    ...(options.length ? { options } : {}),
    ...(lower(str(raw.name)) === "ability score improvement" ? { asi: true as const } : {}),
  };
}

export const classFeatureKeyOf = (raw: Rec) =>
  classFeatureKey(str(raw.name), str(raw.className), str(raw.classSource), String(raw.level), str(raw.source));

/** `{ activation }` si el rasgo se activa (corrección manual o texto); nada si es pasivo. */
function activationOf(key: string, raw: Rec): Pick<FeatureData, "activation"> {
  const activation = activationFor(key, raw.entries);
  return activation ? { activation } : {};
}

export function normalizeClassFeature(raw: Rec): NormalizedEntry {
  const key = classFeatureKeyOf(raw);
  return entry<"classFeature">(header("classFeature", raw, key, {
    parent: { key: keyOf("class", str(raw.className), str(raw.classSource)) },
  }), { level: raw.level as number, className: str(raw.className), ...featureExtras(raw), ...activationOf(key, raw) });
}

export const subclassFeatureKeyOf = (raw: Rec) => subclassFeatureKey([raw.name, raw.className, raw.classSource,
  raw.subclassShortName, raw.subclassSource, raw.level].map(String), str(raw.source));

/**
 * Rasgos enlazados en el texto de otro rasgo (`refClassFeature`, `refSubclassFeature`): en el XPHB la cabecera de una
 * subclase solo enlaza sus rasgos reales, y algunos rasgos de clase enlazan sus partes (Artes marciales, Canalizar
 * divinidad…). No entra en bloques `options`, que son opciones a elegir y no rasgos que se ganan.
 */
function nestedFeatures(entries: unknown): LevelFeature[] {
  const out: LevelFeature[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (isObj(v) && (v.type === "refClassFeature" || v.type === "refSubclassFeature")) {
      const r = optionRef(v);
      const parts = str(v.type === "refClassFeature" ? v.classFeature : v.subclassFeature).split("|");
      const level = Number(parts[v.type === "refClassFeature" ? 3 : 5]);
      if (r && Number.isInteger(level)) out.push({ ref: r, level });
    } else if (isObj(v) && v.type !== "options") {
      walk(v.entries);
      walk(v.items);
    }
  };
  walk(entries);
  return out;
}

export function normalizeSubclassFeature(raw: Rec, ctx: NormalizeContext): NormalizedEntry {
  const key = subclassFeatureKeyOf(raw);
  const sub = ctx.subclasses.get(subclassLookup(
    str(raw.subclassShortName), str(raw.className), str(raw.classSource), str(raw.subclassSource)));
  return entry<"subclassFeature">(header("subclassFeature", raw, key, {
    parent: { key: sub?.key ?? prefixed("subclass", `${str(raw.subclassShortName)}|${str(raw.className)}|${str(raw.classSource)}`) },
  }), {
    level: raw.level as number,
    className: str(raw.className),
    subclassName: sub?.name ?? str(raw.subclassShortName),
    ...featureExtras(raw),
    ...activationOf(key, raw),
  });
}

/** Invocación, metamagia o maniobra. Los prerrequisitos de otro rasgo opcional guardan su clave. */
export function normalizeOptionalFeature(raw: Rec): NormalizedEntry {
  const data: OptionalFeatureData = { featureType: asArr(raw.featureType).map(str) };
  // Varias alternativas de prerrequisito se cumplen con una; en el XPHB siempre hay una sola
  const pre = asArr(raw.prerequisite).find(isObj);
  if (pre) {
    const p: NonNullable<OptionalFeatureData["prerequisite"]> = {};
    const level = isObj(pre.level) ? pre.level.level : pre.level;
    if (typeof level === "number") p.level = level;
    // Los conjuros a elegir (`{ choose: "level=0|class=Warlock" }`) no son una referencia y se omiten
    const spell = asArr(pre.spell).find((s) => typeof s === "string");
    if (typeof spell === "string") p.spell = ref("spell", cleanRefKey(spell));
    for (const o of asArr(pre.optionalfeature).map(str).filter(Boolean)) {
      const key = prefixed("optionalFeature", cleanRefKey(o));
      if (/^pact of the /i.test(o)) p.pact = key;
      else p.feature = key;
    }
    if (Object.keys(p).length) data.prerequisite = p;
  }
  // Conjuros fijos (Armadura de sombras, Paso ascendente…) y elegidos (Pacto del tomo)
  const additional = asArr(raw.additionalSpells);
  const spells = spellGrants(additional, 1);
  if (spells.length) data.spells = spells;
  const choices = spellChoices(additional);
  if (choices.length) data.spellChoices = choices;
  return entry<"optionalFeature">(
    header("optionalFeature", raw, keyOf("optionalFeature", str(raw.name), str(raw.source))), data);
}

// «Female», «Female Adult», «Arabic, Female» → female; «Clan» y «Family» son apellidos; el resto («Child»,
// «Virtue», «Duergar Clan»…), otra tabla
function nameGender(option: string): NameGender {
  const o = lower(option);
  if (/\bfemale\b/.test(o)) return "female";
  if (/\bmale\b/.test(o)) return "male";
  return o === "clan" || o === "family" ? "family" : "other";
}

export function normalizeNameTable(raw: Rec): NormalizedEntry {
  const head = header("nameTable", raw, keyOf("nameTable", str(raw.name), str(raw.source)), { description: "" });
  const tables = asArr(raw.tables).filter(isObj).map((t) => ({
    option: str(t.option),
    gender: nameGender(str(t.option)),
    names: [...new Set(asArr(t.table).map((r) => (isObj(r) ? str(r.result).trim() : "")).filter(Boolean))],
  }));
  return entry<"nameTable">(head, { species: head.identifier, tables });
}

/**
 * Rasgos de clase y subclase cuyo texto pide elegir («choose», «of your choice») sin un bloque `options`, sin ser una
 * mejora de característica y sin una especificación escrita a mano (`specified`: claves de rasgo). El importador los
 * lista para que no quede ninguna elección sin pedir.
 */
export function textChoiceFeatures(entries: NormalizedEntry[], specified: ReadonlySet<string>): string[] {
  return entries
    .filter((e) => (e.kind === "classFeature" || e.kind === "subclassFeature")
      && /\bchoose\b|\bof your choice\b/i.test(e.description)
      && !(e.data as FeatureData).options?.length
      && !(e.data as FeatureData).asi
      && !specified.has(e.key))
    .map((e) => e.key);
}

/**
 * Rasgos de clase y subclase que ningún personaje llegaría a tener: ni están en los rasgos de una clase o subclase ni
 * son opciones de un rasgo alcanzable. `required` son claves que deben ser alcanzables aunque no se hayan importado
 * (las elecciones escritas a mano); también se listan si faltan.
 */
export function unreachableFeatures(entries: NormalizedEntry[], required: Iterable<string>): string[] {
  const byKey = new Map(entries.map((e) => [e.key, e]));
  const reachable = new Set<string>();
  const queue = entries.flatMap((e) =>
    e.kind === "class" || e.kind === "subclass" ? (e.data as { features: LevelFeature[] }).features.map((f) => f.ref.key) : []);
  for (let key = queue.pop(); key !== undefined; key = queue.pop()) {
    if (reachable.has(key)) continue;
    reachable.add(key);
    const e = byKey.get(key);
    if (e?.kind === "classFeature" || e?.kind === "subclassFeature") {
      queue.push(...((e.data as FeatureData).options ?? []).map((o) => o.key));
    }
  }
  const imported = entries.filter((e) => e.kind === "classFeature" || e.kind === "subclassFeature").map((e) => e.key);
  return [...new Set([...imported, ...required])].filter((key) => !reachable.has(key));
}

// ---------- todo junto ----------

/**
 * Normaliza todas las entradas de la fuente `source` (p. ej. `"XPHB"`). Resuelve `_copy` y `_versions` y valida
 * cada entrada; las que no validan (o fallan al normalizarse) van a `errors` y no a `entries`.
 */
export function normalizeAll(files: RawFiles, source: string): {
  entries: NormalizedEntry[];
  errors: { key: string; errors: string[] }[];
} {
  const src = lower(source);
  const entries: NormalizedEntry[] = [];
  const errors: { key: string; errors: string[] }[] = [];
  // Entradas de la fuente con su `_copy` resuelto; `pool` es donde se buscan las bases
  const fromSource = (kind: EntryKind, list: unknown[] | undefined, pool: unknown[] = list ?? []): Rec[] =>
    (list ?? []).flatMap((x) => {
      if (!isObj(x) || lower(str(x.source)) !== src) return [];
      try {
        return [resolveCopy(x, pool) as Rec];
      } catch (err) {
        errors.push({ key: keyOf(kind, str(x.name), str(x.source)), errors: [err instanceof Error ? err.message : String(err)] });
        return [];
      }
    });

  const run = (kind: EntryKind, raw: Rec, make: () => NormalizedEntry) => {
    let e: NormalizedEntry;
    try {
      e = make();
    } catch (err) {
      errors.push({ key: keyOf(kind, str(raw.name), str(raw.source)), errors: [err instanceof Error ? err.message : String(err)] });
      return;
    }
    const r = validateEntryData(e.kind, e.data);
    if (r.ok) entries.push(e);
    else errors.push({ key: e.key, errors: r.errors });
  };

  // Contexto
  const skills = fromSource("skill", files.skills?.skill);
  const ctx: NormalizeContext = {
    skillNames: skills.map((s) => lower(str(s.name))),
    spellClasses: new Map(),
    subclasses: new Map(),
    classFluff: new Map(),
  };
  for (const f of files.classFluff ?? []) {
    for (const x of asArr(f.classFluff)) {
      if (!isObj(x) || lower(str(x.source)) !== src) continue;
      // Suele ser una sola sección con el nombre de la clase: se omite ese título
      const body = asArr(x.entries);
      const only = body.length === 1 && isObj(body[0]) && body[0].type === "section" ? body[0] : null;
      const text = entriesToBbcode(only ? asArr(only.entries) : body);
      if (text) ctx.classFluff.set(keyOf("class", str(x.name), str(x.source)), text);
    }
  }
  for (const [spellSource, byName] of Object.entries(files.spellSources ?? {})) {
    for (const [name, info] of Object.entries(byName)) {
      ctx.spellClasses.set(keyOf("spell", name, spellSource), [...new Set((info.class ?? []).map((c) => toIdentifier(c.name)))]);
    }
  }
  const classFiles = files.classes ?? [];
  const subclasses = classFiles.flatMap((f) => fromSource("subclass", f.subclass));
  for (const s of subclasses) {
    ctx.subclasses.set(
      subclassLookup(str(s.shortName), str(s.className), str(s.classSource), str(s.source)),
      { key: subclassKey(s), name: str(s.name) },
    );
  }

  for (const r of fromSource("species", files.races?.race)) {
    run("species", r, () => normalizeSpecies(r, ctx));
    for (const v of expandVersions(r)) run("lineage", v, () => normalizeLineage(v, r));
  }
  for (const b of fromSource("background", files.backgrounds?.background)) run("background", b, () => normalizeBackground(b));
  for (const f of fromSource("feat", files.feats?.feat)) {
    run("feat", f, () => normalizeFeat(f));
    for (const v of expandVersions(f)) run("feat", v, () => normalizeFeat(v));
  }
  // Las subclases que conceden un conjuro (dominios, juramentos…) también figuran en su lista: `subclass:life-domain`
  for (const s of subclasses) {
    const additional = asArr(s.additionalSpells);
    for (const grant of [...spellGrants(additional), ...spellOptions(additional).flatMap((o) => o.spells)]) {
      const classes = ctx.spellClasses.get(grant.ref.key) ?? [];
      const id = `subclass:${toIdentifier(str(s.name))}`;
      if (!classes.includes(id)) ctx.spellClasses.set(grant.ref.key, [...classes, id]);
    }
  }
  for (const s of (files.spells ?? []).flatMap((f) => fromSource("spell", f.spell))) run("spell", s, () => normalizeSpell(s, ctx));
  // Los `itemGroup` (Símbolo sagrado, Canalizador druídico…) son entradas de equipo como las demás
  const itemPool = [...(files.itemsBase?.baseitem ?? []), ...(files.items?.item ?? []), ...(files.items?.itemGroup ?? [])];
  for (const i of fromSource("item", itemPool)) run("item", i, () => normalizeItem(i));
  // Bestiario: las copias («_copy») pueden venir de cualquier libro
  const monsterPool = (files.bestiary ?? []).flatMap((f) => f.monster ?? []);
  for (const m of fromSource("monster", monsterPool)) run("monster", m, () => normalizeMonster(m));
  for (const l of fromSource("language", files.languages?.language)) run("language", l, () => normalizeLanguage(l));
  for (const s of skills) run("skill", s, () => normalizeSkill(s));
  for (const a of fromSource("action", files.actions?.action)) run("action", a, () => normalizeAction(a));
  // Rasgos sin normalizar por clave, para seguir los enlaces de su texto
  const rawFeatures = new Map<string, Rec>();
  for (const f of classFiles) {
    for (const c of fromSource("class", f.class)) run("class", c, () => normalizeClass(c, ctx));
    for (const c of fromSource("classFeature", f.classFeature)) {
      rawFeatures.set(classFeatureKeyOf(c), c);
      run("classFeature", c, () => normalizeClassFeature(c));
    }
  }
  for (const s of subclasses) run("subclass", s, () => normalizeSubclass(s));
  for (const f of classFiles) {
    for (const s of fromSource("subclassFeature", f.subclassFeature)) {
      rawFeatures.set(subclassFeatureKeyOf(s), s);
      run("subclassFeature", s, () => normalizeSubclassFeature(s, ctx));
    }
  }
  // Cada clase y subclase gana los rasgos enlazados desde los suyos, justo detrás del que los enlaza y sin repetir
  for (const e of entries) {
    if (e.kind !== "class" && e.kind !== "subclass") continue;
    const data = e.data as { features: LevelFeature[] };
    const seen = new Set(data.features.map((f) => f.ref.key));
    const features: LevelFeature[] = [];
    const add = (f: LevelFeature) => {
      features.push(f);
      for (const n of nestedFeatures(rawFeatures.get(f.ref.key)?.entries)) {
        if (seen.has(n.ref.key)) continue;
        seen.add(n.ref.key);
        add(n);
      }
    };
    data.features.forEach(add);
    data.features = features;
  }
  for (const o of fromSource("optionalFeature", files.optionalFeatures?.optionalfeature)) {
    run("optionalFeature", o, () => normalizeOptionalFeature(o));
  }
  for (const n of fromSource("nameTable", files.names?.name)) run("nameTable", n, () => normalizeNameTable(n));
  return { entries, errors };
}
