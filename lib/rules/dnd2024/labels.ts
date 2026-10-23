// Nombres en español de los identificadores que guarda el catálogo en minúsculas e inglés (habilidades, etc.).
import type { Ability } from "@/lib/rules/types";

export const ABILITY_NAMES: Record<Ability, string> = {
  str: "Fuerza", dex: "Destreza", con: "Constitución", int: "Inteligencia", wis: "Sabiduría", cha: "Carisma",
};

export const ABILITY_ABBR: Record<Ability, string> = {
  str: "FUE", dex: "DES", con: "CON", int: "INT", wis: "SAB", cha: "CAR",
};

// Distancias en pies con su equivalencia en metros (5 pies = 1,5 m): "30 pies (9 m)"
export const metersText = (feet: number) => `${(Math.round(feet * 0.3 * 10) / 10).toLocaleString("es-ES")} m`;
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
const DAMAGE_TYPE_NAMES: Record<string, string> = {
  A: "ácido", B: "contundente", C: "frío", F: "fuego", I: "veneno", L: "relámpago", N: "necrótico", O: "fuerza",
  P: "perforante", R: "radiante", S: "cortante", T: "trueno", Y: "psíquico",
};
const WEAPON_PROPERTY_NAMES: Record<string, string> = {
  A: "Munición", AF: "Munición (futurista)", BF: "Ráfaga", F: "Sutil", H: "Pesada", L: "Ligera", LD: "Carga",
  R: "Alcance", RLD: "Recarga", S: "Especial", T: "Arrojadiza", V: "Versátil", "2H": "A dos manos",
};
const MASTERY_NAMES: Record<string, string> = {
  cleave: "Hendir", graze: "Rozar", nick: "Mellar", push: "Empujar", sap: "Debilitar", slow: "Ralentizar",
  topple: "Derribar", vex: "Incordiar",
};
export const damageTypeName = (code: string) => DAMAGE_TYPE_NAMES[code] ?? code;
export const weaponPropertyName = (code: string) => WEAPON_PROPERTY_NAMES[code] ?? code;
export const masteryName = (id: string) => MASTERY_NAMES[id.toLowerCase()] ?? capitalize(id);
