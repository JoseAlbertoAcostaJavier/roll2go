// Nombres en español de los identificadores que guarda el catálogo en minúsculas e inglés (habilidades, etc.).
import type { Ability } from "@/lib/rules/types";

export const ABILITY_NAMES: Record<Ability, string> = {
  str: "Fuerza", dex: "Destreza", con: "Constitución", int: "Inteligencia", wis: "Sabiduría", cha: "Carisma",
};

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
