// Tipos compartidos del catálogo de reglas (importación de 5etools y libros de usuario).

export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
export const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

/**
 * Referencia a otra entrada; puede apuntar a un libro distinto. Las claves (`BookEntry.key` y `Ref.key`) llevan
 * el tipo delante, igual que el destino de `[ref=tipo:clave]`: `spell:fireball|xphb`, `species:elf|xphb`,
 * `classFeature:rage|barbarian|xphb|1`.
 */
export type Ref = { book: string; key: string };

export type EntryKind =
  | "species" | "lineage" | "class" | "subclass" | "classFeature" | "subclassFeature"
  | "background" | "feat" | "spell" | "item" | "language" | "skill" | "optionalFeature" | "nameTable";
// Todos los tipos de entrada, en el orden de EntryKind
export const ENTRY_KINDS: readonly EntryKind[] = [
  "species",
  "lineage",
  "class",
  "subclass",
  "classFeature",
  "subclassFeature",
  "background",
  "feat",
  "spell",
  "item",
  "language",
  "skill",
  "optionalFeature",
  "nameTable",
];

/** Elemento de equipo: una entrada del catálogo, monedas (pc) o un texto libre. */
export type Pack = { ref?: Ref; quantity?: number; value?: number; displayName?: string };

/** Conjuro concedido; `level` es el nivel de personaje o de clase en que se obtiene (1-20). */
export type SpellGrant = { level: number; ref: Ref; ability?: Ability };
export type LevelFeature = { ref: Ref; level: number };
/** Opciones de equipo inicial por letra: `{ A: [...], B: [...], C: [...] }`. */
export type Equipment = Record<string, Pack[]>;

/** Tipos de daño o estados (en minúsculas e inglés, como 5etools); `choose` es una elección que se hace en la ficha. */
export type DefenseList = (string | { choose: { from: string[]; count: number } })[];
/** Resistencias, inmunidades y vulnerabilidades al daño, e inmunidades a estados. */
export type Defenses = { resist?: DefenseList; immune?: DefenseList; vulnerable?: DefenseList; conditionImmune?: DefenseList };

export type SpeciesData = {
  size: ("S" | "M" | "L")[];
  speed: number;
  darkvision: number;
  creatureType: string;
  skills: { fixed: string[]; choose?: { count: number; from: string[] } };
  spells: SpellGrant[];
  hasLineages: boolean;
  defenses?: Defenses;
};

export type LineageData = {
  darkvision?: number;
  speed?: number;
  spells: SpellGrant[];
  traitName: string;
  defenses?: Defenses;
};

/** Progresión de espacios: lanzador completo, medio (redondeando hacia arriba), tercio (hacia abajo) o Magia de pacto. */
export type SpellcastingProgression = "full" | "half" | "third" | "pact";
/** Cómo se eligen los conjuros preparados (ver `lib/rules/dnd2024/spells/spellcastingModes.ts`). */
export type SpellcastingMode = "list" | "levelUp" | "spellbook";
export type Spellcasting = { ability: Ability; progression: SpellcastingProgression; mode: SpellcastingMode };

/** Número acumulado por nivel de clase, solo en los niveles en que cambia: `{ 2: 2, 10: 4, 17: 6 }`. */
export type LevelCounts = Record<number, number>;

export type ClassProgressions = {
  /** Dotes de una categoría (`FS`, `EB`…) que se ganan por nivel. */
  feats: { category: string[]; levels: LevelCounts }[];
  /** Rasgos opcionales de un tipo (`MM`, `EI`…) que se conocen por nivel. */
  optionalFeatures: { name: string; featureType: string[]; levels: LevelCounts }[];
  /** Armas con maestría por nivel. */
  weaponMastery: LevelCounts | null;
  /** Trucos conocidos en cada nivel de clase (20 valores). */
  cantrips: number[] | null;
  /** Conjuros preparados en cada nivel de clase (20 valores). */
  prepared: number[] | null;
  /** Conjuros que se añaden al libro en cada nivel de clase (20 valores; el Mago empieza con 6). */
  spellbook: number[] | null;
};

/** Tabla de la clase: columnas con nombre en español y un valor de texto por nivel (20). */
export type ClassTable = { columns: { label: string; values: string[] }[] };

export type MulticlassData = {
  /** 13 o más en estas características; con `any`, basta una de ellas. */
  requirements: { abilities: Ability[]; any: boolean };
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    skills: { count: number; from: string[] } | null;
  };
};

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
  spellcasting: Spellcasting | null;
  /** Conjuros siempre preparados de la clase por nivel de clase (Castigo divino del Paladín…). */
  spells?: { level: number; ref: Ref }[];
  features: LevelFeature[];
  progressions: ClassProgressions;
  table: ClassTable;
  multiclass: MulticlassData;
  /** Nombre del grupo de subclases en español («Senda primitiva», «Dominio divino»…). */
  subclassTitle: string;
};

/** Conjuros alternativos con nombre: el personaje tiene los de una sola (la tierra del Círculo de la Tierra). */
export type SpellOption = { name: string; spells: { level: number; ref: Ref }[] };

export type SubclassData = {
  features: LevelFeature[];
  spells: { level: number; ref: Ref }[];
  /** Alternativas entre las que el dueño elige en la ficha (`sheet.spellOption`); no se conceden por sí solas. */
  spellOptions?: SpellOption[];
  /**
   * Dotes y rasgos opcionales propios de la subclase (estilo de combate del Campeón, maniobras…) y, en las
   * subclases lanzadoras, sus trucos y preparados por nivel de clase.
   */
  progressions: Pick<ClassProgressions, "feats" | "optionalFeatures"> & Partial<Pick<ClassProgressions, "cantrips" | "prepared">>;
  /** Solo las subclases lanzadoras (Caballero arcano, Embaucador arcano). */
  spellcasting?: Spellcasting;
};

export type FeatureData = {
  level: number;
  className: string;
  subclassName?: string;
  /** Opciones entre las que se elige una (rasgos de clase o rasgos opcionales). */
  options?: Ref[];
  /** Mejora de característica (o dote general). */
  asi?: true;
};

/** Invocación, metamagia, maniobra… `pact` y `feature` son claves de otro `optionalFeature`. */
export type OptionalFeatureData = {
  featureType: string[];
  prerequisite?: { level?: number; spell?: Ref; pact?: string; feature?: string };
  /** Conjuros fijos que da (Armadura de sombras → Armadura de mago), desde que se tiene (nivel 1). */
  spells?: SpellGrant[];
  /** Conjuros que se eligen (Pacto del tomo), como los de las dotes. */
  spellChoices?: FeatSpellChoice[];
};

export type BackgroundData = {
  abilities: Ability[];
  feat: Ref;
  skills: string[];
  tools: string[];
  equipment: Equipment;
};

/** Filtro de un conjuro a elegir: su nivel y, si se dan, las listas de clase, las escuelas o que sea ritual. */
export type FeatSpellFilter = { level: number; classes?: string[]; schools?: string[]; ritual?: true };
/**
 * Conjuros a elegir de una dote: `count` que cumplan `filter`, desde el nivel de personaje `level`. `lists`: listas de
 * clase alternativas (la dote base de Iniciado en la magia); se elige una (`FeatSpellsValue.list`) y hace de
 * `filter.classes`.
 */
export type FeatSpellChoice = { level: number; count: number; filter: FeatSpellFilter; lists?: string[] };

export type FeatData = {
  category: "origin" | "general" | "fightingStyle" | "epicBoon";
  /** Código de categoría de 5etools (`FS`, `FS:P`…): distingue los estilos de combate propios de una clase. */
  categoryCode?: string;
  prerequisite?: string;
  repeatable: boolean;
  abilityIncrease?: Ability[];
  /** Conjuros fijos que da (Tocado por los feéricos → Paso brumoso), por nivel de personaje. */
  spells?: SpellGrant[];
  /** Si da conjuros, aunque sean solo elegidos (Iniciado en la magia, Lanzador de rituales…). */
  grantsSpells?: true;
  /** Conjuros que se eligen (Iniciado en la magia, Lanzador de rituales, la mitad elegida de Tocado por los feéricos…). */
  spellChoices?: FeatSpellChoice[];
  /** Características entre las que se elige la de lanzamiento de esos conjuros (Iniciado en la magia). */
  spellAbility?: Ability[];
  defenses?: Defenses;
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
  /** Identificadores de las clases que lo tienen en su lista (`wizard`) y de las subclases que lo conceden (`subclass:life-domain`). */
  classes: string[];
  /** Etiquetas en español para filtrar: «Daño de fuego», «Salvación de Destreza», «Concentración»… */
  tags: string[];
  /** Mejora con un espacio de nivel superior (BBCode); también va al final de la descripción. */
  higherLevels?: string;
};

export type ItemData = {
  type: string;
  weight: number;
  value: number; // pc
  /** Rareza de un objeto mágico (`uncommon`, `rare`…); los objetos normales no la llevan. */
  rarity?: string;
  armor?: { ac: number; dexCap: number | null; stealthDisadvantage: boolean; category: string };
  weapon?: { damage: string; damageType: string; properties: string[]; mastery?: string; category: string;
    /** Alcance de 5etools en pies, tal cual ("20/60"); solo en armas arrojadizas o de distancia. */ range?: string };
  contents?: { ref: Ref; quantity: number }[];
  defenses?: Defenses;
};

export type LanguageData = { type: "standard" | "rare" };

/** Género de una tabla de nombres; `family` son apellidos o clanes y `other`, el resto (niños, virtudes…). */
export type NameGender = "male" | "female" | "family" | "other";
/** Tablas de nombres de una especie (`species` es su identificador: `dwarf`, `half-orc`…). */
export type NameTableData = { species: string; tables: { option: string; gender: NameGender; names: string[] }[] };
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
  optionalFeature: OptionalFeatureData;
  nameTable: NameTableData;
};
