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
const pack = shape({ "ref?": ref, "quantity?": num, "value?": num, "displayName?": str });
const equipment = shape({ A: arrayOf(pack), B: arrayOf(pack) });
const spellGrant = shape({ level: int(0, 9), ref, "ability?": ability });
const levelFeature = shape({ ref, level: int(1, 20) });
const exactly = (n: number, c: Check): Check => (v, p, e) => {
  if (Array.isArray(v) && v.length !== n) { e.push(`${p}: deben ser ${n}`); return; }
  c(v, p, e);
};

const feature = shape({ level: int(1, 20), className: str, "subclassName?": str });

const checks: { [K in EntryKind]: Check } = {
  species: shape({
    size: arrayOf(oneOf("S", "M", "L")),
    speed: num,
    darkvision: num,
    creatureType: str,
    skills: shape({ fixed: strings, "choose?": shape({ count: int(1, 20), from: strings }) }),
    spells: arrayOf(spellGrant),
    hasLineages: bool,
  }),
  lineage: shape({ "darkvision?": num, spells: arrayOf(spellGrant), traitName: str }),
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
    spellcasting: nullable(shape({
      ability,
      progression: nullable(oneOf("full", "half", "pact")),
      table: arrayOf(arrayOf(num)),
    })),
    features: arrayOf(levelFeature),
  }),
  subclass: shape({ features: arrayOf(levelFeature), spells: arrayOf(shape({ level: int(0, 9), ref })) }),
  classFeature: feature,
  subclassFeature: feature,
  background: shape({
    abilities: exactly(3, abilities),
    feat: ref,
    skills: strings,
    tools: strings,
    equipment,
  }),
  feat: shape({
    category: oneOf("origin", "general", "fightingStyle", "epicBoon"),
    "prerequisite?": str,
    repeatable: bool,
    "abilityIncrease?": abilities,
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
  }),
  item: shape({
    type: str,
    weight: num,
    value: num,
    "armor?": shape({ ac: num, dexCap: nullable(num), stealthDisadvantage: bool, category: str }),
    "weapon?": shape({ damage: str, damageType: str, properties: strings, "mastery?": str, category: str }),
    "contents?": arrayOf(shape({ ref, quantity: num })),
  }),
  language: shape({ type: oneOf("standard", "rare") }),
  skill: shape({ ability }),
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
