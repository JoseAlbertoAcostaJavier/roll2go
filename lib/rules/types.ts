// Tipos compartidos del catálogo de reglas (importación de 5etools y libros de usuario).

export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
export const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

/** Referencia a otra entrada; puede apuntar a un libro distinto. */
export type Ref = { book: string; key: string };

export type EntryKind =
  | "species" | "lineage" | "class" | "subclass" | "classFeature" | "subclassFeature"
  | "background" | "feat" | "spell" | "item" | "language" | "skill";

/** Elemento de equipo: una entrada del catálogo, monedas (pc) o un texto libre. */
export type Pack = { ref?: Ref; quantity?: number; value?: number; displayName?: string };

export type SpellGrant = { level: number; ref: Ref; ability?: Ability };
export type LevelFeature = { ref: Ref; level: number };
export type Equipment = { A: Pack[]; B: Pack[] };

export type SpeciesData = {
  size: ("S" | "M" | "L")[];
  speed: number;
  darkvision: number;
  creatureType: string;
  skills: { fixed: string[]; choose?: { count: number; from: string[] } };
  spells: SpellGrant[];
  hasLineages: boolean;
};

export type LineageData = {
  darkvision?: number;
  spells: SpellGrant[];
  traitName: string;
};

export type SpellcastingProgression = "full" | "half" | "pact" | null;

export type ClassData = {
  hitDie: 6 | 8 | 10 | 12;
  primaryAbility: Ability[];
  saves: Ability[];
  armor: string[];
  weapons: string[];
  tools: string[];
  skills: { count: number; from: string[] };
  equipment: Equipment;
  subclassLevel: number;
  asiLevels: number[];
  spellcasting: { ability: Ability; progression: SpellcastingProgression; table: number[][] } | null;
  features: LevelFeature[];
};

export type SubclassData = {
  features: LevelFeature[];
  spells: { level: number; ref: Ref }[];
};

export type FeatureData = {
  level: number;
  className: string;
  subclassName?: string;
};

export type BackgroundData = {
  abilities: Ability[];
  feat: Ref;
  skills: string[];
  tools: string[];
  equipment: Equipment;
};

export type FeatData = {
  category: "origin" | "general" | "fightingStyle" | "epicBoon";
  prerequisite?: string;
  repeatable: boolean;
  abilityIncrease?: Ability[];
};

export type SpellData = {
  level: number;
  school: string;
  time: string;
  range: string;
  components: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  classes: string[];
};

export type ItemData = {
  type: string;
  weight: number;
  value: number; // pc
  armor?: { ac: number; dexCap: number | null; stealthDisadvantage: boolean; category: string };
  weapon?: { damage: string; damageType: string; properties: string[]; mastery?: string; category: string };
  contents?: { ref: Ref; quantity: number }[];
};

export type LanguageData = { type: "standard" | "rare" };
export type SkillData = { ability: Ability };

export type EntryData = {
  species: SpeciesData;
  lineage: LineageData;
  class: ClassData;
  subclass: SubclassData;
  classFeature: FeatureData;
  subclassFeature: FeatureData;
  background: BackgroundData;
  feat: FeatData;
  spell: SpellData;
  item: ItemData;
  language: LanguageData;
  skill: SkillData;
};
