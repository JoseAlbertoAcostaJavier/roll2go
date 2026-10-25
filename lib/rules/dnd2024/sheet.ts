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
  xp: number;
  hp: { max: number | null; current: number | null; temp: number };
};

/** Dote elegida; `ability`: la característica que sube en 1 si la dote da esa mejora. */
export type FeatPickValue = Named & { ability?: Ability };

/**
 * Conjuros elegidos en un nivel para una clase (o subclase lanzadora): trucos nuevos, conjuros aprendidos (modo
 * `levelUp`) o entradas del libro (modo `spellbook`) y, opcionalmente, en la misma subida, un conjuro aprendido
 * (`replace`, solo modo `levelUp`) y un truco (`replaceCantrip`) que se sustituyen por otro del mismo tipo.
 */
export type SpellChoice = {
  class: Ref;
  cantrips: Named[];
  spells: Named[];
  replace?: { out: Named; in: Named };
  replaceCantrip?: { out: Named; in: Named };
};

/**
 * Conjuros elegidos con una dote (Iniciado en la magia…): trucos, conjuros y, si la dote la deja elegir, la
 * característica de lanzamiento.
 */
export type FeatSpellsValue = { feat: Ref; cantrips: Named[]; spells: Named[]; ability?: Ability };

/**
 * Elección hecha al subir un nivel. `source` es la clave del rasgo o de la progresión que la pide. `replaced`: dote o
 * rasgo opcional de esa misma elección que se sustituye por uno de los de `value`.
 */
export type Choice =
  | { type: "subclass"; source: string; value: Named }
  | { type: "asi"; source: string; value: { abilities: Partial<Record<Ability, 1 | 2>> } | { feat: Named; ability?: Ability } }
  | { type: "feat"; source: string; value: FeatPickValue[]; replaced?: Named[] }
  | { type: "optionalFeature"; source: string; value: Named[]; replaced?: Named[] }
  | { type: "weaponMastery"; source: string; value: Ref[] }
  | { type: "featureOption"; source: string; value: Named }
  | { type: "skills"; source: string; value: string[] }
  | { type: "expertise"; source: string; value: string[] }
  | { type: "spells"; source: string; value: SpellChoice }
  | { type: "featSpells"; source: string; value: FeatSpellsValue }
  // Arcano místico: un conjuro de la lista de la clase del nivel que pide el rasgo (`source`)
  | { type: "arcanum"; source: string; value: Named };

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
  /** Solo para armaduras, escudos y armas. */
  equipped: boolean;
  notes: string;
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
   * Alternativa de conjuros elegida en la ficha por subclase (`SubclassData.spellOptions`, la tierra del Círculo de la
   * Tierra): `{ [clave de la subclase]: nombre }`. Las hojas sin ninguna no lo tienen.
   */
  spellOption?: Record<string, string>;
  /**
   * Usos gastados de los conjuros que se lanzan una vez por descanso largo (`CasterBlock.limited`), por clave
   * (`arcanum:<refKey>`). Las claves que el personaje ya no tiene se ignoran. Las hojas sin ninguno no lo tienen.
   */
  limitedUsed?: Record<string, number>;
  /**
   * Armas con maestría actuales: empiezan con las elecciones `weaponMastery` del historial y se pueden cambiar en la
   * ficha. Las hojas guardadas antes no lo tienen: ver `currentMasteries`.
   */
  weaponMasteries: Ref[];
};

export type AnySheet = Dnd2024Sheet | Dnd2024SheetV2;
