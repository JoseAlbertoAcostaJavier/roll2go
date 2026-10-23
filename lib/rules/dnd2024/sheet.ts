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
  rolls: { values: number[]; token: string } | null;
  speciesChoices: { skills: string[]; size: "S" | "M" | "L" | null };
  alignment: string;
  appearance: string;
  age: string;
  languages: string;
  notes: string;
  xp: number;
  hp: { max: number | null; current: number | null; temp: number };
};
