// Validadores propios (sin dependencias) para el campo `data` de cada tipo de entrada.
import { ABILITIES } from "./types";
import type { EntryData, EntryKind } from "./types";

type Rec = Record<string, unknown>;
type Check = (v: unknown, path: string, errors: string[]) => void;

const isObj = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

const str: Check = (v, p, e) => { if (typeof v !== "string") e.push(`${p}: debe ser texto`); };
const num: Check = (v, p, e) => { if (typeof v !== "number" || !Number.isFinite(v)) e.push(`${p}: debe ser un número`); };
const bool: Check = (v, p, e) => { if (typeof v !== "boolean") e.push(`${p}: debe ser verdadero o falso`); };
const int = (min: number, max: number): Check => (v, p, e) => {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) e.push(`${p}: debe ser un entero entre ${min} y ${max}`);
};
const oneOf = (...opts: unknown[]): Check => (v, p, e) => {
  if (!opts.includes(v)) e.push(`${p}: valor no válido (${opts.map(String).join(", ")})`);
};
const arrayOf = (item: Check): Check => (v, p, e) => {
  if (!Array.isArray(v)) { e.push(`${p}: debe ser una lista`); return; }
  v.forEach((x, i) => item(x, `${p}[${i}]`, e));
};
const strings = arrayOf(str);
const ability = oneOf(...ABILITIES);
const abilities = arrayOf(ability);
const nullable = (c: Check): Check => (v, p, e) => { if (v !== null) c(v, p, e); };

/** Objeto con campos tipados. Las claves terminadas en `?` son opcionales. */
const shape = (fields: Record<string, Check>): Check => (v, p, e) => {
  if (!isObj(v)) { e.push(`${p || "data"}: debe ser un objeto`); return; }
  for (const [key, check] of Object.entries(fields)) {
    const optional = key.endsWith("?");
    const name = optional ? key.slice(0, -1) : key;
    const value = v[name];
    const path = p ? `${p}.${name}` : name;
    if (value === undefined) { if (!optional) e.push(`${path}: es obligatorio`); continue; }
    check(value, path, e);
  }
};

const ref = shape({ book: str, key: str });
const choiceKind = oneOf("gaming", "instrument", "artisan", "simple", "simpleMelee", "martial", "martialMelee");
const choose: Check = (v, p, e) => {
  shape({ kinds: arrayOf(choiceKind), label: str })(v, p, e);
  if (isObj(v) && Array.isArray(v.kinds) && v.kinds.length === 0) e.push(`${p}.kinds: debe tener al menos un tipo`);
};
const pack = shape({ "ref?": ref, "quantity?": num, "value?": num, "displayName?": str, "choose?": choose });
/** Opciones de equipo por letra mayúscula ("A", "B", "C"…); al menos una. */
const equipment: Check = (v, p, e) => {
  if (!isObj(v)) { e.push(`${p}: debe ser un objeto`); return; }
  const letters = Object.keys(v);
  if (!letters.length) e.push(`${p}: debe tener al menos una opción`);
  for (const letter of letters) {
    if (!/^[A-Z]$/.test(letter)) e.push(`${p}.${letter}: la opción debe ser una letra mayúscula`);
    else arrayOf(pack)(v[letter], `${p}.${letter}`, e);
  }
};
// `level` es el nivel de personaje o de clase en que se obtiene el conjuro, no el nivel del conjuro
const spellGrant = shape({ level: int(1, 20), ref, "ability?": ability, "uses?": oneOf("pb") });
// Conjuros a elegir de una dote o de una invocación (Pacto del tomo)
const featSpellChoices = arrayOf(shape({
  level: int(1, 20),
  count: int(1, 20),
  filter: shape({ level: int(0, 9), "classes?": strings, "schools?": strings, "ritual?": oneOf(true) }),
  "lists?": strings,
}));
const levelFeature = shape({ ref, level: int(1, 20) });
const exactly = (n: number, c: Check): Check => (v, p, e) => {
  if (Array.isArray(v) && v.length !== n) { e.push(`${p}: deben ser ${n}`); return; }
  c(v, p, e);
};

const backgroundAbilities: Check = (v, p, e) => {
  if (Array.isArray(v) && v.length !== 3 && v.length !== 6) { e.push(`${p}: deben ser 3 o las 6`); return; }
  abilities(v, p, e);
};

const feature = shape({
  level: int(1, 20), className: str, "subclassName?": str, "options?": arrayOf(ref), "asi?": oneOf(true),
  "activation?": oneOf("action", "bonus", "reaction"),
});

/** Número acumulado por nivel de clase: claves de 1 a 20 y valores enteros. */
const levelCounts: Check = (v, p, e) => {
  if (!isObj(v)) { e.push(`${p}: debe ser un objeto`); return; }
  for (const [level, count] of Object.entries(v)) {
    if (!/^\d+$/.test(level) || Number(level) < 1 || Number(level) > 20) e.push(`${p}.${level}: el nivel debe estar entre 1 y 20`);
    else int(0, 100)(count, `${p}.${level}`, e);
  }
};
/** Un valor por nivel de clase (20). */
const perLevel = (c: Check): Check => exactly(20, arrayOf(c));

const featProgressions = arrayOf(shape({ category: strings, levels: levelCounts }));
const optionalFeatureProgressions = arrayOf(shape({ name: str, featureType: strings, levels: levelCounts }));
const progressions = shape({
  feats: featProgressions,
  optionalFeatures: optionalFeatureProgressions,
  weaponMastery: nullable(levelCounts),
  cantrips: nullable(perLevel(int(0, 100))),
  prepared: nullable(perLevel(int(0, 100))),
  spellbook: nullable(perLevel(int(0, 100))),
});
const spellcasting = shape({
  ability,
  progression: oneOf("full", "half", "third", "pact"),
  mode: oneOf("list", "levelUp", "spellbook"),
});
const classTable = shape({ columns: arrayOf(shape({ "id?": str, label: str, values: perLevel(str) })) });
const multiclass = shape({
  requirements: shape({ abilities, any: bool }),
  proficiencies: shape({
    armor: strings,
    weapons: strings,
    tools: strings,
    skills: nullable(shape({ count: int(1, 20), from: strings })),
  }),
});

const checks: { [K in EntryKind]: Check } = {
  species: shape({
    size: arrayOf(oneOf("S", "M", "L")),
    speed: num,
    darkvision: num,
    creatureType: str,
    skills: shape({ fixed: strings, "choose?": shape({ count: int(1, 20), from: strings }) }),
    spells: arrayOf(spellGrant),
    hasLineages: bool,
    "naturalArmor?": bool,
  }),
  lineage: shape({ "darkvision?": num, "speed?": num, spells: arrayOf(spellGrant), traitName: str }),
  class: shape({
    hitDie: oneOf(6, 8, 10, 12),
    primaryAbility: abilities,
    saves: abilities,
    armor: strings,
    weapons: strings,
    tools: strings,
    skills: shape({ count: int(0, 20), from: strings }),
    equipment,
    subclassLevel: int(1, 20),
    asiLevels: arrayOf(int(1, 20)),
    spellcasting: nullable(spellcasting),
    "spells?": arrayOf(shape({ level: int(1, 20), ref })),
    features: arrayOf(levelFeature),
    progressions,
    table: classTable,
    multiclass,
    subclassTitle: str,
  }),
  subclass: shape({
    features: arrayOf(levelFeature),
    spells: arrayOf(shape({ level: int(1, 20), ref })),
    "spellOptions?": arrayOf(shape({ name: str, spells: arrayOf(shape({ level: int(1, 20), ref })) })),
    progressions: shape({
      feats: featProgressions,
      optionalFeatures: optionalFeatureProgressions,
      "cantrips?": nullable(perLevel(int(0, 100))),
      "prepared?": nullable(perLevel(int(0, 100))),
    }),
    "spellcasting?": spellcasting,
  }),
  classFeature: feature,
  subclassFeature: feature,
  background: shape({
    abilities: backgroundAbilities,
    feat: nullable(ref),
    skills: strings,
    tools: strings,
    equipment,
  }),
  feat: shape({
    category: oneOf("origin", "general", "fightingStyle", "epicBoon"),
    "categoryCode?": str,
    "prerequisite?": str,
    repeatable: bool,
    "abilityIncrease?": abilities,
    "spells?": arrayOf(spellGrant),
    "grantsSpells?": oneOf(true),
    "spellChoices?": featSpellChoices,
    "spellAbility?": abilities,
  }),
  spell: shape({
    level: int(0, 9),
    school: str,
    time: str,
    range: str,
    components: str,
    duration: str,
    concentration: bool,
    ritual: bool,
    classes: strings,
    tags: strings,
    "higherLevels?": str,
    "damage?": shape({ dice: str, "scaling?": arrayOf(shape({ level: int(1, 20), dice: str })) }),
    "healing?": shape({ dice: str }),
  }),
  item: shape({
    type: str,
    weight: num,
    value: num,
    "rarity?": str,
    "armor?": shape({ ac: num, dexCap: nullable(num), stealthDisadvantage: bool, category: str }),
    "weapon?": shape({ damage: str, damageType: str, properties: strings, "mastery?": str, category: str }),
    "contents?": arrayOf(shape({ ref, quantity: num })),
    "container?": shape({ weight: nullable(num), volume: nullable(num), items: arrayOf(shape({ ref, count: num })), weightless: bool }),
  }),
  condition: shape({ type: oneOf("condition", "disease") }),
  monster: shape({
    size: strings, type: str, tags: strings, alignment: strings, ac: num, acNote: str, hp: num, hpFormula: str,
    abilities: shape({ str: num, dex: num, con: num, int: num, wis: num, cha: num }),
    senses: strings, passive: num, languages: strings, cr: str, resist: strings, immune: strings, vulnerable: strings, conditionImmune: strings,
    traits: arrayOf(shape({ name: str, text: str })), actions: arrayOf(shape({ name: str, text: str })), bonus: arrayOf(shape({ name: str, text: str })),
    reactions: arrayOf(shape({ name: str, text: str })), legendary: arrayOf(shape({ name: str, text: str })), environment: strings,
  }),
  language: shape({ type: oneOf("standard", "rare") }),
  skill: shape({ ability }),
  optionalFeature: shape({
    featureType: strings,
    "prerequisite?": shape({ "level?": int(1, 20), "spell?": ref, "pact?": str, "feature?": str }),
    "spells?": arrayOf(spellGrant),
    "spellChoices?": featSpellChoices,
  }),
  action: shape({ time: oneOf("action", "bonus", "reaction", "free", "varies") }),
  nameTable: shape({
    species: str,
    tables: arrayOf(shape({ option: str, gender: oneOf("male", "female", "family", "other"), names: strings })),
  }),
};

export function validateEntryData<K extends EntryKind>(
  kind: K,
  data: unknown,
): { ok: true; value: EntryData[K] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  checks[kind](data, "", errors);
  return errors.length ? { ok: false, errors } : { ok: true, value: data as EntryData[K] };
}

/** Minúsculas y sin diacríticos, para buscar sin distinguir tildes ni mayúsculas. */
export function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
