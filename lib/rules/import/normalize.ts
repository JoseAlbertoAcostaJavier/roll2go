// Normalización de los JSON de 5etools a entradas del catálogo (`BookEntry`) validadas con `validateEntryData`.
//
// Las referencias a otras entradas se construyen con `book: BOOK_PLACEHOLDER`; el script de importación lo
// sustituye por el id del libro que está importando. `parent` solo guarda la clave (`{ key }`), porque el
// padre siempre está en el mismo libro.
import { ABILITIES } from "../types";
import type {
  Ability, EntryData, EntryKind, Equipment, LevelFeature, Pack, Ref, SpellGrant,
} from "../types";
import { normalizeName, validateEntryData } from "../schemas";
import { entriesToBbcode } from "./toBbcode";

export const BOOK_PLACEHOLDER = "__BOOK__";

export type NormalizedEntry = {
  kind: EntryKind;
  key: string;
  identifier: string;
  parent: { key: string } | null;
  name: string;
  description: string;
  srd52: boolean;
  data: EntryData[EntryKind];
};

type Rec = Record<string, unknown>;

/** JSON de 5etools ya leídos, agrupados por archivo. */
export type RawFiles = {
  races?: { race?: unknown[] };
  backgrounds?: { background?: unknown[] };
  feats?: { feat?: unknown[] };
  items?: { item?: unknown[] };
  itemsBase?: { baseitem?: unknown[] };
  languages?: { language?: unknown[] };
  skills?: { skill?: unknown[] };
  /** Un elemento por `spells/spells-*.json`. */
  spells?: { spell?: unknown[] }[];
  /** `spells/sources.json`: fuente → nombre del conjuro → clases que lo tienen. */
  spellSources?: Record<string, Record<string, { class?: { name: string; source: string }[] }>>;
  /** Un elemento por `class/class-*.json`. */
  classes?: { class?: unknown[]; subclass?: unknown[]; classFeature?: unknown[]; subclassFeature?: unknown[] }[];
};

/** Datos de contexto que necesitan algunos normalizadores. */
export type NormalizeContext = {
  /** Nombres de todas las habilidades (para "elige cualquiera"). */
  skillNames: string[];
  /** `nombre|fuente` del conjuro en minúsculas → clases en minúsculas. */
  spellClasses: Map<string, string[]>;
  /** `nombre corto|clase|fuente de la clase|fuente` en minúsculas → subclase. */
  subclasses: Map<string, { key: string; name: string }>;
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

/** Clave estilo 5etools: `nombre|fuente` en minúsculas. */
const keyOf = (name: string, source: string) => lower(`${name}|${source}`);

/** Referencia del tipo `"dancing lights|xphb#c"` → clave sin sufijo `#…`. */
const cleanRefKey = (s: string) => lower(s.split("#")[0]);

const ref = (key: string): Ref => ({ book: BOOK_PLACEHOLDER, key });

/** Quita las etiquetas `{@tag texto|…}` dejando el texto visible. */
function plainText(s: string): string {
  let out = s;
  const innermost = /\{@\w+\s+([^{}]*)\}/;
  for (let guard = 0; guard < 1000; guard++) {
    const m = innermost.exec(out);
    if (!m) break;
    const parts = m[1].split("|");
    const shown = parts.length >= 3 && parts[2] ? parts[2] : parts[0];
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

// Campos de la base que no pasan a una copia (son propios de cada entrada en 5etools)
const NOT_COPIED = ["srd52", "basicRules2024", "page", "_versions", "hasFluff", "hasFluffImages", "reprintedAs"];

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

/** `additionalSpells` → conjuros fijos por nivel de personaje/clase. Las elecciones (`choose`) se omiten. */
function spellGrants(additional: unknown[]): SpellGrant[] {
  const grants: SpellGrant[] = [];
  for (const block of additional) {
    if (!isObj(block)) continue;
    const ability = isObj(block.ability) ? undefined : block.ability;
    for (const group of ["known", "prepared", "innate", "expanded"]) {
      const byLevel = block[group];
      if (!isObj(byLevel)) continue;
      for (const [lvl, value] of Object.entries(byLevel)) {
        const level = Number(lvl);
        if (!Number.isInteger(level)) continue; // "_" = sin nivel, s1… = nivel de conjuro
        for (const s of collectStrings(value)) {
          grants.push({ level, ref: ref(cleanRefKey(s)), ...(isAbility(ability) ? { ability } : {}) });
        }
      }
    }
  }
  return grants.sort((a, b) => a.level - b.level);
}

const collectStrings = (v: unknown): string[] =>
  typeof v === "string" ? [v]
    : Array.isArray(v) ? v.flatMap(collectStrings)
      : isObj(v) ? Object.values(v).flatMap(collectStrings) : [];

/** Elemento de equipo inicial de 5etools → `Pack`. */
function toPack(p: unknown): Pack | null {
  if (typeof p === "string") return { ref: ref(cleanRefKey(p)) };
  if (!isObj(p)) return null;
  const pack: Pack = {};
  if (typeof p.item === "string") pack.ref = ref(cleanRefKey(p.item));
  if (typeof p.value === "number") pack.value = p.value;
  if (typeof p.quantity === "number") pack.quantity = p.quantity;
  const label = str(p.displayName) || str(p.special) || str(p.equipmentType) || asArr(p.equipmentTypes).map(str).join(" / ");
  if (label) pack.displayName = label;
  return Object.keys(pack).length ? pack : null;
}

/** Solo se importan las opciones A y B (las demás, p. ej. la C del Guerrero, se omiten). */
function toEquipment(raw: unknown): Equipment {
  const opts = isObj(raw) ? raw : {};
  const list = (k: string) => asArr(opts[k]).map(toPack).filter((x): x is Pack => x !== null);
  return { A: list("A"), B: list("B") };
}

/** `[{ a: true, b: true }]` → `["a", "b"]` (las claves `any…`/`choose` también se conservan como texto). */
const trueKeys = (v: unknown): string[] =>
  asArr(v).flatMap((o) => (isObj(o) ? Object.keys(o).filter((k) => k !== "choose") : typeof o === "string" ? [o] : []));

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
    ...extra,
  };
}

const entry = <K extends EntryKind>(head: Omit<NormalizedEntry, "data">, data: EntryData[K]): NormalizedEntry =>
  ({ ...head, data });

// ---------- normalizadores por tipo ----------

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
  const speed = isObj(raw.speed) ? raw.speed.walk : raw.speed;
  // Los conjuros con nombre pertenecen a un legado; las especies 2024 no tienen aumentos de característica
  const ownSpells = asArr(raw.additionalSpells).filter((b) => isObj(b) && b.name === undefined);
  return entry<"species">(header("species", raw, keyOf(str(raw.name), str(raw.source))), {
    size: asArr(raw.size).map(str) as ("S" | "M" | "L")[],
    speed: typeof speed === "number" ? speed : 30,
    darkvision: typeof raw.darkvision === "number" ? raw.darkvision : 0,
    creatureType: str(asArr(raw.creatureTypes)[0]) || "humanoid",
    skills,
    spells: spellGrants(ownSpells),
    hasLineages: asArr(raw._versions).length > 0,
  });
}

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
  };
  if (typeof version.darkvision === "number" && version.darkvision !== species.darkvision) data.darkvision = version.darkvision;
  return entry<"lineage">({
    kind: "lineage",
    key: keyOf(name, str(version.source)),
    identifier: toIdentifier(name),
    parent: { key: keyOf(str(species.name), str(species.source)) },
    name,
    description: entriesToBbcode(own),
    srd52: Boolean(species.srd52),
  }, data);
}

export function normalizeBackground(raw: Rec): NormalizedEntry {
  const abilityBlock = asArr(raw.ability)[0];
  const weighted = isObj(abilityBlock) && isObj(abilityBlock.choose) && isObj(abilityBlock.choose.weighted)
    ? abilityBlock.choose.weighted : {};
  const featKey = Object.keys(asArr(raw.feats)[0] ?? {})[0] ?? "";
  return entry<"background">(header("background", raw, keyOf(str(raw.name), str(raw.source))), {
    abilities: asArr(weighted.from).map(str) as Ability[],
    feat: ref(lower(featKey)),
    skills: trueKeys(raw.skillProficiencies),
    tools: trueKeys(raw.toolProficiencies),
    equipment: toEquipment(asArr(raw.startingEquipment)[0]),
  });
}

const FEAT_CATEGORIES: Record<string, EntryData["feat"]["category"]> = {
  O: "origin", G: "general", FS: "fightingStyle", "FS:P": "fightingStyle", "FS:R": "fightingStyle", EB: "epicBoon",
};

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
    category: FEAT_CATEGORIES[str(raw.category)] ?? (str(raw.category) as EntryData["feat"]["category"]),
    repeatable: raw.repeatable === true,
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
  return entry<"feat">(header("feat", raw, keyOf(str(raw.name), str(raw.source))), data);
}

const TIME_UNITS: Record<string, string> = { action: "action", bonus: "bonus action", reaction: "reaction" };
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

function spellTime(time: unknown): string {
  return asArr(time).map((t) => {
    if (!isObj(t)) return "";
    const n = typeof t.number === "number" ? t.number : 1;
    const unit = str(t.unit);
    return unit in TIME_UNITS ? `${n} ${TIME_UNITS[unit]}` : plural(n, unit);
  }).filter(Boolean).join(" or ");
}

function spellRange(range: unknown): string {
  if (!isObj(range)) return "";
  const d = isObj(range.distance) ? range.distance : {};
  const dType = str(d.type);
  const amount = typeof d.amount === "number" ? d.amount : 0;
  const special: Record<string, string> = { self: "Self", touch: "Touch", sight: "Sight", unlimited: "Unlimited" };
  if (range.type === "special") return "Special";
  if (range.type === "point") {
    if (dType in special) return special[dType];
    return dType === "miles" ? plural(amount, "mile") : `${amount} ${dType}`;
  }
  // Áreas centradas en el lanzador: cone, line, emanation, sphere, cube…
  const unit = dType === "miles" ? "mile" : "foot";
  return `Self (${amount}-${unit} ${str(range.type)})`;
}

function spellComponents(c: unknown): string {
  if (!isObj(c)) return "";
  const out: string[] = [];
  if (c.v) out.push("V");
  if (c.s) out.push("S");
  if (c.m) {
    const m = typeof c.m === "string" ? c.m : isObj(c.m) ? str(c.m.text) : "";
    out.push(m ? `M (${m})` : "M");
  }
  if (c.r) out.push("R");
  return out.join(", ");
}

function spellDuration(duration: unknown): string {
  return asArr(duration).map((d) => {
    if (!isObj(d)) return "";
    switch (d.type) {
      case "instant": return "Instantaneous";
      case "timed": {
        const t = isObj(d.duration) ? d.duration : {};
        const text = plural(typeof t.amount === "number" ? t.amount : 1, str(t.type));
        return d.concentration ? `Concentration, up to ${text}` : text;
      }
      case "permanent": return asArr(d.ends).includes("trigger") ? "Until dispelled or triggered" : "Until dispelled";
      default: return "Special";
    }
  }).filter(Boolean).join(" or ");
}

export function normalizeSpell(raw: Rec, ctx: NormalizeContext): NormalizedEntry {
  const key = keyOf(str(raw.name), str(raw.source));
  const head = header("spell", raw, key);
  head.description = entriesToBbcode([...asArr(raw.entries), ...asArr(raw.entriesHigherLevel)]);
  const meta = isObj(raw.meta) ? raw.meta : {};
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
  });
}

const stripSource = (s: string) => s.split("|")[0];
const ARMOR: Record<string, { category: string; dexCap: number | null }> = {
  LA: { category: "light", dexCap: null },
  MA: { category: "medium", dexCap: 2 },
  HA: { category: "heavy", dexCap: 0 },
  S: { category: "shield", dexCap: null },
};

export function normalizeItem(raw: Rec): NormalizedEntry {
  const type = stripSource(str(raw.type)) || "OTH";
  const data: EntryData["item"] = {
    type,
    weight: typeof raw.weight === "number" ? raw.weight : 0,
    value: typeof raw.value === "number" ? raw.value : 0,
  };
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
    };
  }
  if (Array.isArray(raw.packContents)) {
    data.contents = raw.packContents.flatMap((c) => {
      const p = toPack(c);
      return p?.ref ? [{ ref: p.ref, quantity: p.quantity ?? 1 }] : [];
    });
  }
  return entry<"item">(header("item", raw, keyOf(str(raw.name), str(raw.source))), data);
}

export function normalizeLanguage(raw: Rec): NormalizedEntry {
  return entry<"language">(header("language", raw, keyOf(str(raw.name), str(raw.source))),
    { type: raw.type as "standard" | "rare" });
}

export function normalizeSkill(raw: Rec): NormalizedEntry {
  return entry<"skill">(header("skill", raw, keyOf(str(raw.name), str(raw.source))), { ability: raw.ability as Ability });
}

/** Referencia de rasgo `"Rage|Barbarian|XPHB|1"` (o `{ classFeature: … }`) → clave y nivel. */
function featureRef(f: unknown, field: string): LevelFeature | null {
  const s = typeof f === "string" ? f : isObj(f) ? str(f[field]) : "";
  if (!s) return null;
  const parts = s.split("|");
  const level = Number(parts[parts.length - 1]);
  return Number.isInteger(level) ? { ref: ref(lower(s)), level } : null;
}

const PROGRESSION: Record<string, "full" | "half" | "pact"> = { full: "full", "1/2": "half", artificer: "half", pact: "pact" };

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
  const ability = raw.spellcastingAbility;
  const spellTable = asArr(raw.classTableGroups).find((g) => isObj(g) && Array.isArray(g.rowsSpellProgression));
  return entry<"class">(header("class", raw, keyOf(str(raw.name), str(raw.source))), {
    hitDie: hd as EntryData["class"]["hitDie"],
    primaryAbility: ABILITIES.filter((a) => asArr(raw.primaryAbility).some((p) => isObj(p) && p[a] === true)),
    saves: asArr(raw.proficiency).map(str) as Ability[],
    armor: asArr(prof.armor).map((a) => plainText(str(a))),
    weapons: asArr(prof.weapons).map((w) => plainText(str(w))),
    tools: asArr(prof.tools).map((t) => plainText(str(t))),
    skills,
    equipment: toEquipment(asArr(isObj(raw.startingEquipment) ? raw.startingEquipment.defaultData : [])[0]),
    subclassLevel: subclassAt?.level ?? 3,
    asiLevels: features.filter((f) => f.ref.key.startsWith("ability score improvement|")).map((f) => f.level),
    spellcasting: isAbility(ability)
      ? {
        ability,
        progression: PROGRESSION[str(raw.casterProgression)] ?? null,
        table: isObj(spellTable) ? (spellTable.rowsSpellProgression as number[][]) : [],
      }
      : null,
    features,
  });
}

/** Clave de subclase: `nombre|clase|fuente de la clase` (+ `|fuente` si es otra). */
const subclassKey = (raw: Rec) => {
  const k = lower(`${str(raw.name)}|${str(raw.className)}|${str(raw.classSource)}`);
  return lower(str(raw.source)) === lower(str(raw.classSource)) ? k : `${k}|${lower(str(raw.source))}`;
};
const subclassLookup = (shortName: string, className: string, classSource: string, source: string) =>
  lower(`${shortName}|${className}|${classSource}|${source}`);

export function normalizeSubclass(raw: Rec): NormalizedEntry {
  return entry<"subclass">(header("subclass", raw, subclassKey(raw), {
    parent: { key: keyOf(str(raw.className), str(raw.classSource)) },
  }), {
    features: asArr(raw.subclassFeatures).map((f) => featureRef(f, "subclassFeature"))
      .filter((x): x is LevelFeature => x !== null),
    spells: spellGrants(asArr(raw.additionalSpells)).map(({ level, ref: r }) => ({ level, ref: r })),
  });
}

export function normalizeClassFeature(raw: Rec): NormalizedEntry {
  const sourceSuffix = lower(str(raw.source)) === lower(str(raw.classSource)) ? "" : `|${str(raw.source)}`;
  const key = lower(`${str(raw.name)}|${str(raw.className)}|${str(raw.classSource)}|${String(raw.level)}${sourceSuffix}`);
  return entry<"classFeature">(header("classFeature", raw, key, {
    parent: { key: keyOf(str(raw.className), str(raw.classSource)) },
  }), { level: raw.level as number, className: str(raw.className) });
}

export function normalizeSubclassFeature(raw: Rec, ctx: NormalizeContext): NormalizedEntry {
  const sourceSuffix = lower(str(raw.source)) === lower(str(raw.subclassSource)) ? "" : `|${str(raw.source)}`;
  const key = lower([raw.name, raw.className, raw.classSource, raw.subclassShortName, raw.subclassSource, raw.level]
    .map(String).join("|") + sourceSuffix);
  const sub = ctx.subclasses.get(subclassLookup(
    str(raw.subclassShortName), str(raw.className), str(raw.classSource), str(raw.subclassSource)));
  return entry<"subclassFeature">(header("subclassFeature", raw, key, {
    parent: { key: sub?.key ?? lower(`${str(raw.subclassShortName)}|${str(raw.className)}|${str(raw.classSource)}`) },
  }), {
    level: raw.level as number,
    className: str(raw.className),
    subclassName: sub?.name ?? str(raw.subclassShortName),
  });
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
  const fromSource = (list: unknown[] | undefined, pool: unknown[] = list ?? []): Rec[] =>
    (list ?? []).flatMap((x) => {
      if (!isObj(x) || lower(str(x.source)) !== src) return [];
      try {
        return [resolveCopy(x, pool) as Rec];
      } catch (err) {
        errors.push({ key: keyOf(str(x.name), str(x.source)), errors: [err instanceof Error ? err.message : String(err)] });
        return [];
      }
    });

  const run = (raw: Rec, make: () => NormalizedEntry) => {
    let e: NormalizedEntry;
    try {
      e = make();
    } catch (err) {
      errors.push({ key: keyOf(str(raw.name), str(raw.source)), errors: [err instanceof Error ? err.message : String(err)] });
      return;
    }
    const r = validateEntryData(e.kind, e.data);
    if (r.ok) entries.push(e);
    else errors.push({ key: e.key, errors: r.errors });
  };

  // Contexto
  const skills = fromSource(files.skills?.skill);
  const ctx: NormalizeContext = {
    skillNames: skills.map((s) => lower(str(s.name))),
    spellClasses: new Map(),
    subclasses: new Map(),
  };
  for (const [spellSource, byName] of Object.entries(files.spellSources ?? {})) {
    for (const [name, info] of Object.entries(byName)) {
      ctx.spellClasses.set(keyOf(name, spellSource), (info.class ?? []).map((c) => lower(c.name)));
    }
  }
  const classFiles = files.classes ?? [];
  const subclasses = classFiles.flatMap((f) => fromSource(f.subclass));
  for (const s of subclasses) {
    ctx.subclasses.set(
      subclassLookup(str(s.shortName), str(s.className), str(s.classSource), str(s.source)),
      { key: subclassKey(s), name: str(s.name) },
    );
  }

  for (const r of fromSource(files.races?.race)) {
    run(r, () => normalizeSpecies(r, ctx));
    for (const v of expandVersions(r)) run(v, () => normalizeLineage(v, r));
  }
  for (const b of fromSource(files.backgrounds?.background)) run(b, () => normalizeBackground(b));
  for (const f of fromSource(files.feats?.feat)) {
    run(f, () => normalizeFeat(f));
    for (const v of expandVersions(f)) run(v, () => normalizeFeat(v));
  }
  for (const s of (files.spells ?? []).flatMap((f) => fromSource(f.spell))) run(s, () => normalizeSpell(s, ctx));
  const itemPool = [...(files.itemsBase?.baseitem ?? []), ...(files.items?.item ?? [])];
  for (const i of fromSource(itemPool)) run(i, () => normalizeItem(i));
  for (const l of fromSource(files.languages?.language)) run(l, () => normalizeLanguage(l));
  for (const s of skills) run(s, () => normalizeSkill(s));
  for (const f of classFiles) {
    for (const c of fromSource(f.class)) run(c, () => normalizeClass(c, ctx));
    for (const c of fromSource(f.classFeature)) run(c, () => normalizeClassFeature(c));
  }
  for (const s of subclasses) run(s, () => normalizeSubclass(s));
  for (const f of classFiles) for (const s of fromSource(f.subclassFeature)) run(s, () => normalizeSubclassFeature(s, ctx));
  return { entries, errors };
}
