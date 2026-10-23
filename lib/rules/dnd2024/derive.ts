// Valores derivados de una hoja de D&D 2024. Función pura, sin acceso a datos ni a Next: la usan el resumen del
// asistente, la ficha y el exportador a Foundry.
import type { CatalogEntry } from "@/lib/rules/catalog";
import type { Dnd2024Sheet, Named } from "@/lib/rules/dnd2024/sheet";
import {
  ABILITIES,
  type Ability, type BackgroundData, type ClassData, type Equipment, type ItemData, type LineageData,
  type Pack, type Ref, type SpeciesData,
} from "@/lib/rules/types";

export type Derived = {
  abilities: Record<Ability, { score: number; mod: number }>;
  proficiencyBonus: number;
  hpMax: number;
  ac: number;
  initiative: number;
  speed: number;
  darkvision: number;
  saves: Ability[];
  skills: string[];
  armor: string[];
  weapons: string[];
  tools: string[];
  equipment: { name: string; quantity: number }[];
  gold: number;
  /** Nombres guardados de las referencias que ya no existen en el catálogo. */
  missing: string[];
};

const entryKey = (ref: Ref) => `${ref.book}:${ref.key}`;
const modOf = (score: number) => Math.floor((score - 10) / 2);
const uniq = <T>(list: T[]) => [...new Set(list)];
// "item:explorer's pack|xphb" → "explorer's pack"
const bareName = (key: string) => key.replace(/^[^:]*:/, "").split("|")[0];

// Defensa sin armadura: característica que suma a 10 + DES, por clase (nombre de la clave sin tipo ni libro)
const UNARMORED: Record<string, Ability> = { barbarian: "con", monk: "wis" };
const SHIELD_BONUS = 2;

const proficiencyOf = (level: number) => Math.ceil(Math.max(level, 1) / 4) + 1;

export function derive(sheet: Dnd2024Sheet, entries: Map<string, CatalogEntry>): Derived {
  const missing: string[] = [];
  const lookup = (n: Named): CatalogEntry | null => {
    const e = entries.get(entryKey(n.ref)) ?? null;
    if (!e) missing.push(n.name);
    return e;
  };

  const species = lookup(sheet.species);
  const lineage = sheet.lineage ? lookup(sheet.lineage) : null;
  const background = lookup(sheet.background);
  const classes = sheet.classes.map((c) => ({ sheet: c, entry: lookup(c) }));
  for (const c of sheet.classes) if (c.subclass) lookup(c.subclass);

  const speciesData = species?.data as SpeciesData | undefined;
  const lineageData = lineage?.data as LineageData | undefined;
  const backgroundData = background?.data as BackgroundData | undefined;
  const first = classes[0];
  const firstData = first?.entry?.data as ClassData | undefined;

  // Características: base + bonificación del trasfondo, con tope de 20
  const abilities = {} as Derived["abilities"];
  for (const a of ABILITIES) {
    const score = Math.min(20, sheet.baseAbilities[a] + (sheet.background.abilities[a] ?? 0));
    abilities[a] = { score, mod: modOf(score) };
  }
  const conMod = abilities.con.mod;

  // PG: dado máximo en el primer nivel de la primera clase; en los demás, la media del dado
  let hpMax = 0;
  classes.forEach((c, i) => {
    const die = (c.entry?.data as ClassData | undefined)?.hitDie;
    if (!die) return;
    const averaged = Math.max(i === 0 ? c.sheet.level - 1 : c.sheet.level, 0);
    hpMax += (i === 0 ? die + conMod : 0) + averaged * (Math.floor(die / 2) + 1 + conMod);
  });

  // Equipo inicial: el de la primera clase y el del trasfondo, con los paquetes expandidos
  const lines: { key: string; name: string; quantity: number }[] = [];
  let copper = 0;
  const addPacks = (packs: Pack[], multiplier: number) => {
    for (const p of packs) {
      if (p.value) copper += p.value * multiplier;
      if (!p.ref && !p.displayName) continue;
      const item = p.ref ? (entries.get(entryKey(p.ref)) ?? null) : null;
      const quantity = (p.quantity ?? 1) * multiplier;
      if (p.ref && !item) missing.push(p.displayName ?? bareName(p.ref.key));
      const contents = (item?.data as ItemData | undefined)?.contents;
      if (contents) {
        addPacks(contents.map((c) => ({ ref: c.ref, quantity: c.quantity })), quantity);
        continue;
      }
      const key = p.ref ? entryKey(p.ref) : `texto:${p.displayName}`;
      const name = item ? item.nameEs || item.name : (p.displayName ?? bareName(p.ref!.key));
      const line = lines.find((l) => l.key === key);
      if (line) line.quantity += quantity;
      else lines.push({ key, name, quantity });
    }
  };
  const option = (equipment: Equipment | undefined, letter: string) => equipment?.[letter] ?? [];
  addPacks(option(firstData?.equipment, first?.sheet.equipment ?? ""), 1);
  addPacks(option(backgroundData?.equipment, sheet.background.equipment), 1);

  // CA: la mejor armadura de cuerpo del equipo; sin ella, Defensa sin armadura o 10 + DES. El escudo suma siempre.
  let bodyArmor = 0;
  let hasBodyArmor = false;
  let shield = false;
  for (const l of lines) {
    const armor = (entries.get(l.key)?.data as ItemData | undefined)?.armor;
    if (!armor) continue;
    if (armor.category === "shield") {
      shield = true;
      continue;
    }
    const dex = abilities.dex.mod;
    const dexBonus = armor.dexCap === null ? dex : armor.dexCap === 0 ? 0 : Math.min(dex, armor.dexCap);
    hasBodyArmor = true;
    bodyArmor = Math.max(bodyArmor, armor.ac + dexBonus);
  }
  let ac = bodyArmor;
  if (!hasBodyArmor) {
    const extra = first ? UNARMORED[bareName(first.sheet.ref.key)] : undefined;
    ac = 10 + abilities.dex.mod + (extra ? abilities[extra].mod : 0);
  }
  if (shield) ac += SHIELD_BONUS;

  const totalLevel = sheet.classes.reduce((sum, c) => sum + c.level, 0);

  return {
    abilities,
    proficiencyBonus: proficiencyOf(totalLevel),
    hpMax,
    ac,
    initiative: abilities.dex.mod,
    speed: lineageData?.speed ?? speciesData?.speed ?? 30,
    darkvision: Math.max(speciesData?.darkvision ?? 0, lineageData?.darkvision ?? 0),
    saves: firstData?.saves ?? [],
    skills: uniq([
      ...(backgroundData?.skills ?? []),
      ...(speciesData?.skills.fixed ?? []),
      ...sheet.speciesChoices.skills,
      ...sheet.classes.flatMap((c) => c.skills),
    ]),
    armor: firstData?.armor ?? [],
    weapons: firstData?.weapons ?? [],
    tools: uniq([...(firstData?.tools ?? []), ...(backgroundData?.tools ?? [])]),
    equipment: lines.map(({ name, quantity }) => ({ name, quantity })),
    gold: copper / 100,
    missing: uniq(missing),
  };
}
