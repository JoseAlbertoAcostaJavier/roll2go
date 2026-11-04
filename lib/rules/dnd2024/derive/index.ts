// Valores derivados de una hoja de D&D 2024 (spec de la ficha §5). Función pura, sin acceso a datos ni a Next: la
// usan el resumen del asistente, la ficha, la subida de nivel y el exportador a Foundry. Recorre el historial de
// niveles (`levels`) y el inventario de la hoja v2; una v1 se convierte antes en memoria.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { bareName, refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { AnySheet, Dnd2024SheetV2, Named } from "@/lib/rules/dnd2024/sheet/sheet";
import { currentMasteries } from "@/lib/rules/dnd2024/levels/masteries";
import { summarizeClasses, upgradeSheet } from "@/lib/rules/dnd2024/sheet/upgrade";
import type {
  Ability, BackgroundData, ClassData, FeatData, ItemData, LineageData, Ref, SpeciesData,
} from "@/lib/rules/types";
import {
  abilityBreakdowns, saveBreakdowns, saveRows, scoresFromBreakdowns, skillBreakdowns, skillRows,
  type AbilityScores, type SaveRow, type SkillRow,
} from "./abilities";
import { makeBreakdown, type Breakdown } from "./breakdown";
import { armorClassBreakdown, UNARMORED_CLASSES, type ArmorData, type UnarmoredClass } from "./ac";
import { unarmedAttack, weaponAttack, weaponProficient, type Attack } from "./attacks";
import { defensesOf, type DefenseRow } from "./defenses";
import { characterFeats, featureGroups, type FeatureGroup } from "./features";
import { featureUses, usesVars, type FeatureUse } from "./featureUses";
import { fixedLanguageRefs } from "../creation/languages";
import { hitPoints } from "./hp";
import { speedBreakdown } from "./speed";
import { spellsSummary, type SpellsSummary } from "./spells";
import { carriedWeight } from "./weight";

export type { Attack } from "./attacks";
export type { Breakdown, Part } from "./breakdown";
export type { DefenseKind, DefenseRow } from "./defenses";
export type { FeatureGroup } from "./features";
export type { FeatureUse, Recovery } from "./featureUses";
export type { CasterBlock, OtherSpell, Slots, SpellsSummary } from "./spells";
export { armorClass, armorClassBreakdown } from "./ac";
export { weaponAttack } from "./attacks";
export { speedBreakdown } from "./speed";

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
  /** Rasgos con contador de usos (máximo, gastados y recuperación), en el orden de `features`. */
  featureUses: FeatureUse[];
  /** Conjuros: un bloque por clase lanzadora, espacios, conjuros de especie, legado y dotes, y espacios gastados. */
  spells: SpellsSummary;
  /** Si tiene conjuros de alguna fuente (la ficha muestra la pestaña Conjuros). */
  hasSpells: boolean;
  /** Resistencias, inmunidades y vulnerabilidades con sus fuentes (especie, linaje, dotes y objetos equipados). */
  defenses: DefenseRow[];
  /** Nombres guardados de las referencias que ya no existen en el catálogo. */
  missing: string[];
  /** De dónde sale cada valor (sus totales coinciden con los de arriba). */
  breakdowns: {
    abilities: Record<Ability, Breakdown>;
    saves: Record<Ability, Breakdown>;
    /** Por id de habilidad. */
    skills: Record<string, Breakdown>;
    ac: Breakdown;
    initiative: Breakdown;
    speed: Breakdown;
  };
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
// Velocidad: la dote Veloz y la columna de la tabla del Monje con su Movimiento sin armadura
const SPEEDY_FEAT = "feat:speedy|xphb";
const UNARMORED_MOVEMENT_COLUMN = /movimiento sin armadura|unarmored movement/i;
const DEFAULT_SPEED = 30;
const HEAVY = "heavy";
const ARMOR_WARNING = "Sin competencia con esta armadura";
const SHIELD = "shield";
// Dado de Artes marciales del Monje si el catálogo no trae la tabla de clase
const MARTIAL_ARTS_COLUMN = /artes marciales|martial arts/i;
const martialArtsFallback = (level: number) => (level <= 4 ? "1d6" : level <= 10 ? "1d8" : level <= 16 ? "1d10" : "1d12");

// Idiomas con su nombre en español: los fijos, los elegidos y, al final, los del texto antiguo (sin repetir)
function languageNames(
  sheet: Dnd2024SheetV2, summary: Dnd2024SheetV2["classesSummary"], entries: Map<string, CatalogEntry>,
): string[] {
  const levels = Object.fromEntries(summary.map((c) => [bareName(c.class.ref.key), c.level]));
  const refs = [...fixedLanguageRefs(levels, sheet.species.ref.book), ...(sheet.languageChoices ?? [])];
  const names = refs.flatMap((r) => {
    const e = entries.get(refKey(r));
    return e ? [e.nameEs || e.name] : [];
  });
  const old = sheet.languages.split(/[,;\n]/).map((l) => l.trim()).filter(Boolean);
  const seen = new Set<string>();
  return [...names, ...old].filter((n) => !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()));
}

export function derive(input: AnySheet, entries: Map<string, CatalogEntry>): Derived {
  // Los ids de las líneas del inventario no influyen en el cálculo
  // Ids únicos: el peso de los contenedores se calcula por id de línea
  let tmp = 0;
  const sheet = upgradeSheet(input, entries, () => `tmp${++tmp}`);
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
  const nameOf = (r: Ref, fallback: string) => {
    const e = entries.get(refKey(r));
    return e ? e.nameEs ?? e.name : fallback;
  };
  const abilityParts = abilityBreakdowns(sheet, isEpicBoon, nameOf);
  const abilities = scoresFromBreakdowns(abilityParts);
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
  const skillProfs = [
    ...(backgroundData?.skills ?? []), ...(speciesData?.skills.fixed ?? []), ...sheet.speciesChoices.skills,
    ...skillsOf("skills"),
  ];
  const expertise = skillsOf("expertise");
  // Polivalente: Bardo 2
  const jackOfAllTrades = summary.some((c) => bareName(c.class.ref.key) === "bard" && c.level >= 2);
  // Salvaciones: solo las de la primera clase
  const saveProfs = firstData?.saves ?? [];

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
  const acOf = (a: (ArmorData & { name: string }) | null) =>
    armorClassBreakdown({ dex: mods.dex, con: mods.con, wis: mods.wis, armor: a, shield, unarmored });
  // Con el nombre del objeto equipado, para el desglose
  const bodyArmor = equipped.flatMap((e) => (e.data.armor && e.data.armor.category !== SHIELD
    ? [{ ...e.data.armor, name: e.name }] : []))
    .sort((a, b) => acOf(b).total - acOf(a).total)[0] ?? null;
  const armorWarning = (bodyArmor && !armor.includes(bodyArmor.category)) || (shield && !armor.includes(SHIELD))
    ? ARMOR_WARNING : null;
  const acParts = acOf(bodyArmor);
  const acBreakdown = armorWarning ? makeBreakdown(acParts.parts, [armorWarning]) : acParts;

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

  const initiativeBreakdown = makeBreakdown([
    { label: "Modificador de Destreza", value: mods.dex },
    ...(featKeys.includes(ALERT_FEAT) ? [{ label: "Dote: Alerta", value: proficiencyBonus }] : []),
  ]);

  // Velocidad: la del legado si la cambia; si no, la de la especie; sin catálogo, 30
  const speedSource = lineageData?.speed !== undefined ? lineage : species;
  const barbarian = summary.find((c) => bareName(c.class.ref.key) === "barbarian");
  const speedParts = speedBreakdown({
    base: lineageData?.speed ?? speciesData?.speed ?? DEFAULT_SPEED,
    baseLabel: speedSource ? `Velocidad de ${speedSource.nameEs ?? speedSource.name}` : "Velocidad base",
    barbarianLevel: barbarian?.level ?? 0,
    monkLevel: monk < 0 ? 0 : summary[monk].level,
    monkColumn: monk < 0 ? null : classData[monk]?.table?.columns
      .find((c) => UNARMORED_MOVEMENT_COLUMN.test(c.label))?.values[summary[monk].level - 1] ?? null,
    heavyArmor: bodyArmor?.category === HEAVY,
    anyArmor: !!bodyArmor,
    shield,
    speedy: featKeys.includes(SPEEDY_FEAT),
  });

  const ac = acBreakdown.total;
  const initiative = initiativeBreakdown.total;
  const speed = speedParts.total;
  // Defensas: el linaje es una copia completa de su especie (con sus defensas ya incluidas o sustituidas), así que si
  // tiene las suyas valen en lugar de las de la especie
  const defenses = defensesOf([
    ...(lineageData?.defenses
      ? [{ name: nameOf(sheet.lineage!.ref, sheet.lineage!.name), defenses: lineageData.defenses }]
      : [{ name: nameOf(sheet.species.ref, sheet.species.name), defenses: speciesData?.defenses }]),
    ...feats.map((f) => ({
      name: nameOf(f.ref, f.name ?? ""), defenses: (entries.get(refKey(f.ref))?.data as FeatData | undefined)?.defenses,
      chosen: f.resist,
    })),
    ...equipped.map((e) => ({ name: e.name, defenses: e.data.defenses })),
  ]);
  const size = sheet.speciesChoices.size ?? (speciesData?.size.length === 1 ? speciesData.size[0] : null);

  const features = featureGroups(sheet, summary, feats, entries);
  const uses = featureUses(sheet, entries, features, usesVars(
    { prof: proficiencyBonus, mods },
    summary.map((c, i) => ({ name: bareName(c.class.ref.key), level: c.level, data: classData[i] })),
  ));

  return {
    level,
    classes: summary.map((c) => ({ name: c.class.name, level: c.level, subclass: c.subclass?.name ?? null, ref: c.class.ref })),
    abilities,
    proficiencyBonus,
    hp: hitPoints(sheet, mods.con, featKeys),
    ac,
    armorWarning,
    initiative,
    speed,
    darkvision: Math.max(speciesData?.darkvision ?? 0, lineageData?.darkvision ?? 0),
    saves: saveRows(abilities, saveProfs, proficiencyBonus),
    skills: skillRows(abilities, skillProfs, expertise, proficiencyBonus, jackOfAllTrades),
    armor,
    weapons,
    tools,
    languages: languageNames(sheet, summary, entries),
    attacks,
    weight: carriedWeight(sheet.inventory, entries, abilities.str.score, size),
    features,
    featureUses: uses,
    ...spellsSummary(sheet, { abilities, proficiencyBonus }, entries),
    defenses,
    missing: uniq(missing),
    breakdowns: {
      abilities: abilityParts,
      saves: saveBreakdowns(abilities, saveProfs, proficiencyBonus),
      skills: skillBreakdowns(abilities, skillProfs, expertise, proficiencyBonus, jackOfAllTrades),
      ac: acBreakdown,
      initiative: initiativeBreakdown,
      speed: speedParts,
    },
  };
}
