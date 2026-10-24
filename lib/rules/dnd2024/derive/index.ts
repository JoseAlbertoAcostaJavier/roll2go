// Valores derivados de una hoja de D&D 2024 (spec de la ficha §5). Función pura, sin acceso a datos ni a Next: la
// usan el resumen del asistente, la ficha, la subida de nivel y el exportador a Foundry. Recorre el historial de
// niveles (`levels`) y el inventario de la hoja v2; una v1 se convierte antes en memoria.
import type { CatalogEntry } from "@/lib/rules/catalog";
import { bareName, refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import type { AnySheet, Named } from "@/lib/rules/dnd2024/sheet";
import { currentMasteries } from "@/lib/rules/dnd2024/masteries";
import { summarizeClasses, upgradeSheet } from "@/lib/rules/dnd2024/upgrade";
import type {
  Ability, BackgroundData, ClassData, FeatData, ItemData, LineageData, Ref, SpeciesData,
} from "@/lib/rules/types";
import { abilityScores, saveRows, skillRows, type AbilityScores, type SaveRow, type SkillRow } from "./abilities";
import { armorClass, UNARMORED_CLASSES, type ArmorData, type UnarmoredClass } from "./ac";
import { unarmedAttack, weaponAttack, weaponProficient, type Attack } from "./attacks";
import { characterFeats, featureGroups, type FeatureGroup } from "./features";
import { hitPoints } from "./hp";
import { spellsSummary, type SpellsSummary } from "./spells";
import { carriedWeight } from "./weight";

export type { Attack } from "./attacks";
export type { FeatureGroup } from "./features";
export type { CasterBlock, OtherSpell, Slots, SpellsSummary } from "./spells";
export { armorClass } from "./ac";
export { weaponAttack } from "./attacks";

export type Derived = {
  /** Nivel total (número de entradas del historial). */
  level: number;
  classes: { name: string; level: number; subclass: string | null; ref: Ref }[];
  abilities: AbilityScores;
  proficiencyBonus: number;
  hp: { max: number; current: number; temp: number };
  ac: number;
  /** Aviso si no tiene competencia con la armadura o el escudo equipados. */
  armorWarning: string | null;
  initiative: number;
  speed: number;
  darkvision: number;
  saves: SaveRow[];
  /** Las 18 habilidades. */
  skills: SkillRow[];
  /** Competencias de armadura, armas y herramientas (ids del catálogo). */
  armor: string[];
  weapons: string[];
  tools: string[];
  languages: string[];
  attacks: Attack[];
  /** En libras. */
  weight: { total: number; capacity: number; over: boolean };
  features: FeatureGroup[];
  /** Conjuros: un bloque por clase lanzadora, espacios, conjuros de especie, legado y dotes, y espacios gastados. */
  spells: SpellsSummary;
  /** Si tiene conjuros de alguna fuente (la ficha muestra la pestaña Conjuros). */
  hasSpells: boolean;
  /** Nombres guardados de las referencias que ya no existen en el catálogo. */
  missing: string[];
};

// Campos del catálogo que llegan con la parte 4; se leen si ya están
type ClassExtras = {
  table?: { columns: { label: string; values: string[] }[] };
  multiclass?: { proficiencies?: { armor?: string[]; weapons?: string[]; tools?: string[] } };
};

const uniq = <T>(list: T[]) => [...new Set(list)];
const proficiencyOf = (level: number) => Math.ceil(Math.max(level, 1) / 4) + 1;

const EPIC_BOON: FeatData["category"] = "epicBoon";
// La dote Alerta suma el bonificador de competencia a la iniciativa
const ALERT_FEAT = "feat:alert|xphb";
const ARMOR_WARNING = "Sin competencia con esta armadura";
const SHIELD = "shield";
// Dado de Artes marciales del Monje si el catálogo no trae la tabla de clase
const MARTIAL_ARTS_COLUMN = /artes marciales|martial arts/i;
const martialArtsFallback = (level: number) => (level <= 4 ? "1d6" : level <= 10 ? "1d8" : level <= 16 ? "1d10" : "1d12");

export function derive(input: AnySheet, entries: Map<string, CatalogEntry>): Derived {
  // Los ids de las líneas del inventario no influyen en el cálculo
  const sheet = upgradeSheet(input, entries, () => "tmp");
  const missing: string[] = [];
  const lookup = (n: Named): CatalogEntry | null => {
    const e = entries.get(refKey(n.ref)) ?? null;
    if (!e) missing.push(n.name);
    return e;
  };

  const species = lookup(sheet.species);
  const lineage = sheet.lineage ? lookup(sheet.lineage) : null;
  const background = lookup(sheet.background);
  const summary = summarizeClasses(sheet.levels);
  const classData = summary.map((c) => lookup(c.class)?.data as (ClassData & ClassExtras) | undefined);
  for (const c of summary) if (c.subclass) lookup(c.subclass);

  const speciesData = species?.data as SpeciesData | undefined;
  const lineageData = lineage?.data as LineageData | undefined;
  const backgroundData = background?.data as BackgroundData | undefined;
  const firstData = classData[0];

  const level = sheet.levels.length;
  const proficiencyBonus = proficiencyOf(level);
  const isEpicBoon = (r: Ref) => (entries.get(refKey(r))?.data as FeatData | undefined)?.category === EPIC_BOON;
  const abilities = abilityScores(sheet, isEpicBoon);
  const mods = Object.fromEntries(Object.entries(abilities).map(([a, v]) => [a, v.mod])) as Record<Ability, number>;
  const choices = sheet.levels.flatMap((l) => l.choices.map((c) => ({ ...c, n: l.n })));

  const feats = characterFeats(sheet, backgroundData);
  const featKeys = feats.map((f) => f.ref.key);

  // Competencias: todas las de la primera clase y, de las demás, las de multiclase
  const profs = (k: "armor" | "weapons" | "tools") => uniq([
    ...(firstData?.[k] ?? []),
    ...classData.slice(1).flatMap((d) => d?.multiclass?.proficiencies?.[k] ?? []),
  ]);
  const armor = profs("armor");
  const weapons = profs("weapons");
  const tools = uniq([...profs("tools"), ...(backgroundData?.tools ?? [])]);
  const skillsOf = (type: "skills" | "expertise") => choices.flatMap((c) => (c.type === type ? c.value : []));

  // Inventario: objetos equipados y referencias perdidas
  const equipped: { name: string; key: string; data: ItemData }[] = [];
  for (const i of sheet.inventory.items) {
    if (!i.ref) continue;
    const entry = entries.get(refKey(i.ref));
    if (!entry) missing.push(i.name);
    else if (i.equipped) equipped.push({ name: i.name, key: i.ref.key, data: entry.data as ItemData });
  }

  // CA: la armadura de cuerpo equipada que más dé (solo debería haber una) y el escudo
  const unarmored = summary.map((c) => bareName(c.class.ref.key))
    .filter((k): k is UnarmoredClass => (UNARMORED_CLASSES as string[]).includes(k));
  const shield = equipped.some((e) => e.data.armor?.category === SHIELD);
  const acOf = (a: ArmorData | null) =>
    armorClass({ dex: mods.dex, con: mods.con, wis: mods.wis, armor: a, shield, unarmored });
  const bodyArmor = equipped.map((e) => e.data.armor).filter((a): a is ArmorData => !!a && a.category !== SHIELD)
    .sort((a, b) => acOf(b) - acOf(a))[0] ?? null;
  const armorWarning = (bodyArmor && !armor.includes(bodyArmor.category)) || (shield && !armor.includes(SHIELD))
    ? ARMOR_WARNING : null;

  // Ataques: armas equipadas y sin armas. Las Artes marciales del Monje (su dado y la mejor de FUE y DES, sin armas y
  // con armas de monje) solo sin armadura de cuerpo ni escudo
  const monk = summary.findIndex((c) => bareName(c.class.ref.key) === "monk");
  const martialArts = monk < 0 || bodyArmor || shield ? null
    : (classData[monk]?.table?.columns.find((c) => MARTIAL_ARTS_COLUMN.test(c.label))?.values[summary[monk].level - 1]
      || martialArtsFallback(summary[monk].level));
  // Maestrías actuales (se pueden cambiar en la ficha); en hojas anteriores, las elegidas al subir de nivel
  const masteries = new Set(currentMasteries(sheet).map((r) => r.key));
  const attacks = equipped.filter((e) => e.data.weapon).map((e) => weaponAttack(
    { ...e.data, name: e.name }, mods, proficiencyBonus,
    weaponProficient(e.data, [e.name, bareName(e.key)], weapons), masteries.has(e.key), martialArts,
  ));
  attacks.push(unarmedAttack(mods, proficiencyBonus, martialArts));

  const size = sheet.speciesChoices.size ?? (speciesData?.size.length === 1 ? speciesData.size[0] : null);

  return {
    level,
    classes: summary.map((c) => ({ name: c.class.name, level: c.level, subclass: c.subclass?.name ?? null, ref: c.class.ref })),
    abilities,
    proficiencyBonus,
    hp: hitPoints(sheet, mods.con, featKeys),
    ac: acOf(bodyArmor),
    armorWarning,
    initiative: mods.dex + (featKeys.includes(ALERT_FEAT) ? proficiencyBonus : 0),
    speed: lineageData?.speed ?? speciesData?.speed ?? 30,
    darkvision: Math.max(speciesData?.darkvision ?? 0, lineageData?.darkvision ?? 0),
    // Salvaciones: solo las de la primera clase
    saves: saveRows(abilities, firstData?.saves ?? [], proficiencyBonus),
    skills: skillRows(
      abilities,
      [
        ...(backgroundData?.skills ?? []), ...(speciesData?.skills.fixed ?? []), ...sheet.speciesChoices.skills,
        ...skillsOf("skills"),
      ],
      skillsOf("expertise"),
      proficiencyBonus,
    ),
    armor,
    weapons,
    tools,
    languages: sheet.languages.split(/[,;\n]/).map((l) => l.trim()).filter(Boolean),
    attacks,
    weight: carriedWeight(sheet.inventory, entries, abilities.str.score, size),
    features: featureGroups(sheet, summary, feats, entries),
    ...spellsSummary(sheet, { abilities, proficiencyBonus }, entries),
    missing: uniq(missing),
  };
}
