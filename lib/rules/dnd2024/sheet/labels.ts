// Nombres en español de los identificadores que guarda el catálogo en minúsculas e inglés (habilidades, etc.).
import type { Ability, FeatData } from "@/lib/rules/types";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { DefenseKind } from "../derive/defenses";

/** Categoría de dote de 5etools (y de las elecciones de `pendingChoices`) → `FeatData.category`. */
export const FEAT_CATEGORIES: Record<string, FeatData["category"]> = {
  O: "origin", G: "general", FS: "fightingStyle", "FS:P": "fightingStyle", "FS:R": "fightingStyle", EB: "epicBoon",
};

/**
 * Si una dote vale para una elección de dote de las categorías `codes` (`FS`, `FS:P`, `G`…). Se compara el código de
 * 5etools (`categoryCode`): «Guerrero bendito» (`FS:P`) es un estilo de combate solo del Paladín. Las dotes sin
 * código (importadas antes de guardarlo o de libros propios) se comparan por su categoría.
 */
export function featFitsCategories(data: FeatData | null | undefined, codes: readonly string[] = []): boolean {
  if (!data) return false;
  if (data.categoryCode) return codes.includes(data.categoryCode);
  return codes.some((c) => FEAT_CATEGORIES[c] === data.category);
}

// Progresiones de rasgos opcionales de 5etools (por su nombre en minúsculas) → nombre en español
const OPTIONAL_FEATURE_LABELS: Record<string, string> = {
  metamagic: "Metamagia",
  "eldritch invocations": "Invocaciones sobrenaturales",
  maneuvers: "Maniobras",
};
/** «Maneuvers» → «Maniobras»; las que no están, tal cual. */
export const optionalFeatureLabel = (name: string) => OPTIONAL_FEATURE_LABELS[name.toLowerCase()] ?? name;

export const ABILITY_NAMES: Record<Ability, string> = {
  str: "Fuerza", dex: "Destreza", con: "Constitución", int: "Inteligencia", wis: "Sabiduría", cha: "Carisma",
};

/** Tipos de daño (como los guarda el catálogo, en minúsculas e inglés) → nombre en español. */
export const DAMAGE_TYPE_NAMES: Record<string, string> = {
  acid: "Ácido", bludgeoning: "Contundente", cold: "Frío", fire: "Fuego", force: "Fuerza", lightning: "Relámpago",
  necrotic: "Necrótico", piercing: "Perforante", poison: "Veneno", psychic: "Psíquico", radiant: "Radiante",
  slashing: "Cortante", thunder: "Trueno",
};

/** Estados de 5etools (en minúsculas e inglés) → nombre en español, como `condition:*` de `i18n/es.json` (que no se importa aquí para no llevarlo al navegador). */
export const CONDITION_NAMES: Record<string, string> = {
  blinded: "Cegado", charmed: "Hechizado", deafened: "Ensordecido", exhaustion: "Agotamiento", frightened: "Asustado",
  grappled: "Agarrado", incapacitated: "Incapacitado", invisible: "Invisible", paralyzed: "Paralizado",
  petrified: "Petrificado", poisoned: "Envenenado", prone: "Derribado", restrained: "Apresado", stunned: "Aturdido",
  unconscious: "Inconsciente", disease: "Enfermedad",
};

/** Nombre en español del tipo de una defensa: el tipo de daño o el estado; si falta, el tipo tal cual. */
export function defenseTypeName(kind: DefenseKind, type: string): string {
  if (kind === "conditionImmune") return CONDITION_NAMES[type] ?? type;
  return DAMAGE_TYPE_NAMES[type] ?? type;
}

export const ABILITY_ABBR: Record<Ability, string> = {
  str: "FUE", dex: "DES", con: "CON", int: "INT", wis: "SAB", cha: "CAR",
};

/** Modificador con signo: «+3», «+0», «−1». */
export const fmtMod = (m: number) => (m > 0 ? `+${m}` : m < 0 ? `−${-m}` : "+0");

// Distancias en pies con su equivalencia en metros (5 pies = 1,5 m): "30 pies (9 m)"
const metersNumber = (feet: number) => (Math.round(feet * 0.3 * 10) / 10).toLocaleString("es-ES");
export const metersText = (feet: number) => `${metersNumber(feet)} m`;
/** "20/60" pies → "6/18 m" (cada cifra con la misma conversión que `metersText`). */
export const rangeMetersText = (range: string) => `${range.split("/").map((n) => metersNumber(Number(n))).join("/")} m`;
export const distanceText = (feet: number) => `${feet} pies (${metersText(feet)})`;

export const SKILL_NAMES: Record<string, string> = {
  acrobatics: "Acrobacias",
  "animal handling": "Trato con animales",
  arcana: "Conocimiento arcano",
  athletics: "Atletismo",
  deception: "Engaño",
  history: "Historia",
  insight: "Perspicacia",
  intimidation: "Intimidación",
  investigation: "Investigación",
  medicine: "Medicina",
  nature: "Naturaleza",
  perception: "Percepción",
  performance: "Interpretación",
  persuasion: "Persuasión",
  religion: "Religión",
  "sleight of hand": "Juego de manos",
  stealth: "Sigilo",
  survival: "Supervivencia",
};

const SIZE_NAMES: Record<string, string> = { S: "Pequeño", M: "Mediano", L: "Grande" };

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const skillName = (id: string) => SKILL_NAMES[id.toLowerCase()] ?? capitalize(id);
export const sizeName = (id: string) => SIZE_NAMES[id] ?? id;

// Competencias de armadura y armas de las clases
const PROFICIENCY_NAMES: Record<string, string> = {
  light: "Armadura ligera",
  medium: "Armadura intermedia",
  heavy: "Armadura pesada",
  shield: "Escudos",
  simple: "Armas sencillas",
  martial: "Armas marciales",
};
export const proficiencyName = (id: string) => PROFICIENCY_NAMES[id.toLowerCase()] ?? capitalize(id);

// Elecciones genéricas de 5etools: tipos de equipo (`equipmentType`) y herramientas "a elegir" (`any…`)
export const CHOICE_LABELS: Record<string, string> = {
  setGaming: "Un juego (a elegir)",
  instrumentMusical: "Un instrumento musical (a elegir)",
  toolArtisan: "Unas herramientas de artesano (a elegir)",
  focusSpellcastingArcane: "Un canalizador arcano (a elegir)",
  focusSpellcastingDruidic: "Un canalizador druídico (a elegir)",
  focusSpellcastingHoly: "Un símbolo sagrado (a elegir)",
  weaponSimple: "Un arma sencilla (a elegir)",
  weaponSimpleMelee: "Un arma sencilla cuerpo a cuerpo (a elegir)",
  weaponMartial: "Un arma marcial (a elegir)",
  weaponMartialMelee: "Un arma marcial cuerpo a cuerpo (a elegir)",
  anyGamingSet: "Un juego (a elegir)",
  anyArtisansTool: "Unas herramientas de artesano (a elegir)",
  anyMusicalInstrument: "Un instrumento musical (a elegir)",
};

// Herramientas del Manual del Jugador 2024 (mismos nombres que los objetos de `i18n/es.json`)
const TOOL_NAMES: Record<string, string> = {
  "alchemist's supplies": "Suministros de alquimista",
  "brewer's supplies": "Suministros de cervecero",
  "calligrapher's supplies": "Suministros de calígrafo",
  "carpenter's tools": "Herramientas de carpintero",
  "cartographer's tools": "Herramientas de cartógrafo",
  "cobbler's tools": "Herramientas de zapatero",
  "cook's utensils": "Útiles de cocinero",
  "glassblower's tools": "Herramientas de soplador de vidrio",
  "jeweler's tools": "Herramientas de joyero",
  "leatherworker's tools": "Herramientas de curtidor",
  "mason's tools": "Herramientas de albañil",
  "painter's supplies": "Suministros de pintor",
  "potter's tools": "Herramientas de alfarero",
  "smith's tools": "Herramientas de herrero",
  "tinker's tools": "Herramientas de manitas",
  "weaver's tools": "Herramientas de tejedor",
  "woodcarver's tools": "Herramientas de ebanista",
  "disguise kit": "Útiles para disfrazarse",
  "forgery kit": "Útiles para falsificar",
  "herbalism kit": "Útiles de herborista",
  "navigator's tools": "Herramientas de navegante",
  "poisoner's kit": "Útiles de envenenador",
  "thieves' tools": "Herramientas de ladrón",
  "dice set": "Dados",
  "dragonchess set": "Ajedrez dragón",
  "playing card set": "Naipes",
  "playing cards": "Naipes",
  "three-dragon ante set": "Apuesta de los tres dragones",
  bagpipes: "Gaita",
  drum: "Tambor",
  dulcimer: "Dulcémele",
  flute: "Flauta",
  horn: "Cuerno",
  lute: "Laúd",
  lyre: "Lira",
  "pan flute": "Flauta de pan",
  shawm: "Chirimía",
  viol: "Viola",
};

/** Nombre en español de una herramienta (id de 5etools o elección "a elegir"); si no se conoce, el original. */
export const toolName = (id: string) => CHOICE_LABELS[id] ?? TOOL_NAMES[id.toLowerCase()] ?? id;

// Armas: tipos de daño, propiedades y maestrías (códigos e ids de 5etools)
const DAMAGE_CODE_NAMES: Record<string, string> = {
  A: "ácido", B: "contundente", C: "frío", F: "fuego", I: "veneno", L: "relámpago", N: "necrótico", O: "fuerza",
  P: "perforante", R: "radiante", S: "cortante", T: "trueno", Y: "psíquico",
};
const WEAPON_PROPERTY_NAMES: Record<string, string> = {
  A: "Munición", AF: "Munición (futurista)", BF: "Ráfaga", F: "Sutil", H: "Pesada", L: "Ligera", LD: "Carga",
  R: "Alcance", RLD: "Recarga", S: "Especial", T: "Arrojadiza", V: "Versátil", "2H": "A dos manos",
};
const MASTERY_NAMES: Record<string, string> = {
  cleave: "Hendir", graze: "Rozar", nick: "Mellar", push: "Empujar", sap: "Debilitar", slow: "Ralentizar",
  topple: "Derribar", vex: "Vejar",
};
// Clave inglesa del tipo de daño (la de los iconos y los datos de 5etools)
const DAMAGE_CODE_IDS: Record<string, string> = {
  A: "acid", B: "bludgeoning", C: "cold", F: "fire", I: "poison", L: "lightning", N: "necrotic", O: "force",
  P: "piercing", R: "radiant", S: "slashing", T: "thunder", Y: "psychic",
};
export const damageTypeId = (code: string) => DAMAGE_CODE_IDS[code] ?? code.toLowerCase();
export const damageTypeName = (code: string) => DAMAGE_CODE_NAMES[code] ?? code;
export const weaponPropertyName = (code: string) => WEAPON_PROPERTY_NAMES[code] ?? code;
const WEAPON_CATEGORY_NAMES: Record<string, string> = { simple: "Sencilla", martial: "Marcial" };
export const weaponCategoryName = (category: string) => WEAPON_CATEGORY_NAMES[category.toLowerCase()] ?? capitalize(category);
export const masteryName = (id: string) => MASTERY_NAMES[id.toLowerCase()] ?? capitalize(id);

/** Resumen propio, en español, de lo que hace cada maestría de arma (clave en minúsculas, como `MASTERY_NAMES`). */
export const MASTERY_TEXTS: Record<string, string> = {
  cleave: "Si impactas con un ataque cuerpo a cuerpo con esta arma, puedes atacar con ella a una segunda criatura que esté a 1,5 m o menos de la primera y a tu alcance. Si impacta, recibe el daño del arma, pero sin sumar tu modificador de característica salvo que sea negativo. Solo una vez por turno.",
  graze: "Si fallas un ataque con esta arma, la criatura recibe daño igual al modificador de característica que usaste en la tirada, del mismo tipo que el del arma. Ese daño solo mejora si mejora el modificador.",
  nick: "El ataque adicional de la propiedad Ligera lo haces como parte de la acción de Atacar, en lugar de como acción adicional. Solo una vez por turno.",
  push: "Si impactas a una criatura de tamaño Grande o menor, puedes empujarla hasta 3 m en línea recta, alejándola de ti.",
  sap: "Si impactas a una criatura, tiene desventaja en su próxima tirada de ataque antes del comienzo de tu siguiente turno.",
  slow: "Si impactas a una criatura y le haces daño, su velocidad baja 3 m hasta el comienzo de tu siguiente turno. Varios impactos con esta maestría no reducen más de 3 m.",
  topple: "Si impactas a una criatura, puedes obligarla a hacer una salvación de Constitución (CD 8 + el modificador de característica de tu ataque + tu bonificador de competencia). Si la falla, cae derribada.",
  vex: "Si impactas a una criatura y le haces daño, tienes ventaja en tu siguiente tirada de ataque contra ella antes del final de tu siguiente turno.",
};

const ITEM_TYPE_NAMES: Record<string, string> = {
  M: "Arma cuerpo a cuerpo", R: "Arma a distancia", A: "Munición", LA: "Armadura ligera", MA: "Armadura intermedia",
  HA: "Armadura pesada", S: "Escudo", G: "Equipo de aventurero", AT: "Herramientas de artesano", T: "Herramienta",
  GS: "Juego", INS: "Instrumento musical", SCF: "Canalizador mágico", P: "Poción", SC: "Pergamino", RD: "Vara",
  RG: "Anillo", WD: "Varita", FD: "Comida y bebida", TG: "Bien comercial", MNT: "Montura", TAH: "Arreos",
  VEH: "Vehículo", EXP: "Explosivo", $G: "Gema", $A: "Objeto de arte",
};
const RARITY_NAMES: Record<string, string> = {
  common: "Común", uncommon: "Poco común", rare: "Raro", "very rare": "Muy raro", legendary: "Legendario",
  artifact: "Artefacto", varies: "Variable",
};
/** Código de tipo de objeto de 5etools → nombre en español; desconocido u `OTH` → «Objeto». */
export const itemTypeName = (code: string) => ITEM_TYPE_NAMES[code] ?? "Objeto";
/** Rareza de 5etools (`very rare`) → nombre en español; la desconocida, tal cual. */
export const rarityName = (id: string) => RARITY_NAMES[id] ?? id;

// Alternativas de conjuros de una subclase (`SubclassData.spellOptions`): título de la elección y nombre de cada una
const SPELL_OPTION_TITLES: Record<string, string> = { "subclass:circle of the land|druid|xphb": "Tierra" };
const SPELL_OPTION_NAMES: Record<string, string> = {
  "Arid Land": "Árida", "Polar Land": "Polar", "Temperate Land": "Templada", "Tropical Land": "Tropical",
};
export const spellOptionTitle = (subclassKey: string) => SPELL_OPTION_TITLES[subclassKey] ?? "Conjuros de la subclase";
export const spellOptionName = (name: string) => SPELL_OPTION_NAMES[name] ?? name;

// Listas de conjuros (`SpellData.classes`): nombre de la clase
const SPELL_LIST_NAMES: Record<string, string> = {
  artificer: "Artífice", bard: "Bardo", cleric: "Clérigo", druid: "Druida", paladin: "Paladín", ranger: "Explorador",
  sorcerer: "Hechicero", warlock: "Brujo", wizard: "Mago",
};
export const spellListName = (id: string) => SPELL_LIST_NAMES[id] ?? capitalize(id);

/** «Libro, pág. N» de un rasgo o entrada del catálogo; solo el libro si no tiene página; `null` si no hay entrada o no se sabe el libro. */
export function featureReference(entry: CatalogEntry | undefined): string | null {
  if (!entry?.bookName) return null;
  return entry.page ? `${entry.bookName}, pág. ${entry.page}` : entry.bookName;
}

/** Especie con su legado. Si el legado ya lleva el nombre de la especie («Genasi (Fuego)»), basta con él. */
export function speciesLabel(species: string, lineage: string | null | undefined): string {
  if (!lineage) return species;
  return lineage.toLowerCase().startsWith(species.toLowerCase()) ? lineage : `${species} (${lineage})`;
}
