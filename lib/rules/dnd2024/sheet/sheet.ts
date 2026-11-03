// Hoja de personaje de D&D 2024 (campo `Character.sheet`). Guarda elecciones, no resultados.
import type { Ability, Ref } from "@/lib/rules/types";

/** Referencia con una copia del nombre, para mostrarlo si la entrada desaparece del catálogo. */
export type Named = { ref: Ref; name: string };

export type AbilityMethod = "pointBuy" | "roll" | "standard" | "manual";
export const ABILITY_METHODS: AbilityMethod[] = ["pointBuy", "roll", "standard", "manual"];

export type Dnd2024Sheet = {
  version: 1;
  species: Named;
  lineage: Named | null;
  /** `equipment` es la letra de la opción de equipo inicial ("A", "B", "C"…). */
  background: Named & { abilities: Partial<Record<Ability, 1 | 2>>; equipment: string };
  classes: (Named & { level: number; subclass: Named | null; skills: string[]; equipment: string })[];
  abilityMethod: AbilityMethod;
  baseAbilities: Record<Ability, number>;
  /** `dice`: los 4 dados de cada tirada, sin firmar (solo para mostrarlos). */
  rolls: { values: number[]; token: string; dice?: number[][] } | null;
  speciesChoices: { skills: string[]; size: "S" | "M" | "L" | null };
  alignment: string;
  appearance: string;
  age: string;
  languages: string;
  notes: string;
  /** Trasfondo y notas, editables en la ficha. Opcionales: las hojas antiguas los leen como vacíos. */
  gender?: string;
  eyes?: string;
  hair?: string;
  skin?: string;
  height?: string;
  weight?: string;
  faith?: string;
  personality?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  organizations?: string;
  allies?: string;
  enemies?: string;
  xp: number;
  hp: { max: number | null; current: number | null; temp: number };
};

/**
 * Dote elegida; `ability`: la característica que sube en 1 si la dote da esa mejora; `resist`: los tipos de daño
 * elegidos si la dote da resistencia a elegir.
 */
export type FeatPickValue = Named & { ability?: Ability; resist?: string[] };

/**
 * Conjuros elegidos en un nivel para una clase (o subclase lanzadora): trucos nuevos, conjuros aprendidos (modo
 * `levelUp`) o entradas del libro (modo `spellbook`) y, opcionalmente, en la misma subida, un conjuro aprendido
 * (`replace`, solo modo `levelUp`) y un truco (`replaceCantrip`) que se sustituyen por otro del mismo tipo. `free`:
 * conjuros de su escuela que el Sabio de la escuela añade gratis al libro, además de las entradas del nivel.
 */
export type SpellChoice = {
  class: Ref;
  cantrips: Named[];
  spells: Named[];
  free?: Named[];
  replace?: { out: Named; in: Named };
  replaceCantrip?: { out: Named; in: Named };
};

/**
 * Conjuros elegidos con una dote (Iniciado en la magia…) o una invocación (Pacto del tomo): trucos, conjuros y, si la
 * dote la deja elegir, la característica de lanzamiento y la lista (Iniciado en la magia base). En las subidas
 * posteriores, Iniciado en la magia puede cambiar uno de los que tiene por otro (`replace`, con las listas vacías).
 */
export type FeatSpellsValue = {
  feat: Ref; list?: string; cantrips: Named[]; spells: Named[]; ability?: Ability; replace?: { out: Named; in: Named };
};

/** Sustitución de un conjuro por otro al subir de nivel. */
export type SpellSwap = { out: Named; in: Named };

/**
 * Conjuros que da un rasgo fuera de los límites de la clase (Descubrimientos mágicos, Ilusiones mejoradas, Conjuros
 * distintivos) y, en las subidas posteriores en que el rasgo lo permite, uno de ellos sustituido por otro (`replace`).
 */
export type BonusSpellsValue = { spells: Named[]; replace?: SpellSwap };

/**
 * Elección hecha al subir un nivel. `source` es la clave del rasgo o de la progresión que la pide. `replaced`: dote o
 * rasgo opcional de esa misma elección que se sustituye por uno de los de `value`.
 */
export type Choice =
  | { type: "subclass"; source: string; value: Named }
  | { type: "asi"; source: string; value: { abilities: Partial<Record<Ability, 1 | 2>> } | { feat: Named; ability?: Ability; resist?: string[] } }
  | { type: "feat"; source: string; value: FeatPickValue[]; replaced?: Named[] }
  | { type: "optionalFeature"; source: string; value: Named[]; replaced?: Named[] }
  | { type: "weaponMastery"; source: string; value: Ref[] }
  | { type: "featureOption"; source: string; value: Named }
  | { type: "skills"; source: string; value: string[] }
  | { type: "expertise"; source: string; value: string[] }
  | { type: "spells"; source: string; value: SpellChoice }
  | { type: "featSpells"; source: string; value: FeatSpellsValue }
  // Arcano místico: un conjuro de la lista de la clase del nivel que pide el rasgo (`source`) y, desde el segundo,
  // opcionalmente uno de los que tiene sustituido por otro del mismo nivel (`replace`). En los niveles que solo
  // permiten la sustitución, `value` es null
  | { type: "arcanum"; source: string; value: Named | null; replace?: SpellSwap }
  | { type: "bonusSpells"; source: string; value: BonusSpellsValue };

/** Una entrada por nivel de personaje, en orden. */
export type LevelEntry = {
  /** Nivel total tras esta entrada (1..20). */
  n: number;
  /** Clase en la que sube. */
  class: Named;
  /** Nivel en esa clase tras esta entrada. */
  classLevel: number;
  hp: { method: "max" | "average" | "roll"; value: number; token?: string };
  choices: Choice[];
  /** Solo en el nivel 1: letra de la opción de equipo inicial de la clase. */
  equipment?: string;
};

export type Coins = { cp: number; sp: number; ep: number; gp: number; pp: number };

export type InventoryItem = {
  /** Id propio de la línea (ObjectId en texto). */
  id: string;
  /** Objeto del catálogo, o null si es personalizado. */
  ref: Ref | null;
  /** Copia del nombre o nombre libre. */
  name: string;
  quantity: number;
  /** Solo para armaduras, escudos, armas y objetos con resistencias o inmunidades. */
  equipped: boolean;
  notes: string;
  /** Id de la línea contenedora donde va guardado; sin campo = suelto. */
  container?: string | null;
};

export type Inventory = { items: InventoryItem[]; coins: Coins; other: string };

/** Hoja v2: las clases salen del historial de niveles y el equipo inicial se vuelca al inventario. */
export type Dnd2024SheetV2 = Omit<Dnd2024Sheet, "version" | "classes"> & {
  version: 2;
  levels: LevelEntry[];
  /** Copia calculada desde `levels` para el listado y la búsqueda de personajes. */
  classesSummary: { class: Named; level: number; subclass: Named | null }[];
  inventory: Inventory;
  prepared: Record<string, Ref[]>;
  spellbookExtra: Named[];
  slotsUsed: Record<string, number>;
  /**
   * Dados de golpe gastados por clase (`refKey` de la clase, como `summarizeClasses`). Ausente o `{}` = ninguno; el
   * descanso largo lo vacía. Ver `hitDicePools`.
   */
  hitDiceUsed: Record<string, number>;
  /**
   * Alternativa de conjuros elegida en la ficha por subclase (`SubclassData.spellOptions`, la tierra del Círculo de la
   * Tierra): `{ [clave de la subclase]: nombre }`. Las hojas sin ninguna no lo tienen.
   */
  spellOption?: Record<string, string>;
  /**
   * Usos gastados de los conjuros que se lanzan una vez por descanso largo (`CasterBlock.limited`), por clave
   * (`arcanum:<refKey>`, `signature:<refKey>`). Las claves que el personaje ya no tiene se ignoran (y se quitan al
   * borrar un nivel). Las hojas sin ninguno no lo tienen.
   */
  limitedUsed?: Record<string, number>;
  /**
   * Usos gastados de los rasgos con contador (`FeatureUse`), por `refKey` del rasgo. Los gastados por encima del máximo
   * actual se recortan al mostrarlos. Las hojas sin ninguno tienen todo disponible.
   */
  featureUses?: Record<string, number>;
  /**
   * Dominio de conjuros (Mago 18): el conjuro de nivel 1 y el de nivel 2 del libro elegidos en la ficha. Si uno deja
   * de estar en el libro, se ignora. Las hojas sin ninguno no lo tienen.
   */
  spellMastery?: { 1?: Ref; 2?: Ref };
  /**
   * Armas con maestría actuales: empiezan con las elecciones `weaponMastery` del historial y se pueden cambiar en la
   * ficha. Las hojas guardadas antes no lo tienen: ver `currentMasteries`.
   */
  weaponMasteries: Ref[];
  /** Inspiración heroica. Las hojas guardadas antes no lo tienen: ver `statusOf`. */
  heroicInspiration?: boolean;
  /** Estados activos (claves de `CONDITION_NAMES` sin `exhaustion`), en el orden de `CONDITION_NAMES`. */
  conditions?: string[];
  /** Nivel de agotamiento (0–6). */
  exhaustion?: number;
};

export type AnySheet = Dnd2024Sheet | Dnd2024SheetV2;
