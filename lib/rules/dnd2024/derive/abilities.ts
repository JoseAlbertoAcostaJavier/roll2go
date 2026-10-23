// Características, salvaciones y habilidades de la hoja v2.
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet";
import { ABILITIES, type Ability } from "@/lib/rules/types";

export type AbilityScores = Record<Ability, { score: number; mod: number }>;
export type SaveRow = { ability: Ability; proficient: boolean; total: number };
export type SkillRow = { id: string; ability: Ability; proficiency: 0 | 1 | 2; total: number };

/** Las 18 habilidades con su característica (ids del catálogo, en minúsculas e inglés). */
export const SKILL_ABILITIES: Record<string, Ability> = {
  acrobatics: "dex", "animal handling": "wis", arcana: "int", athletics: "str", deception: "cha", history: "int",
  insight: "wis", intimidation: "cha", investigation: "int", medicine: "wis", nature: "int", perception: "wis",
  performance: "cha", persuasion: "cha", religion: "int", "sleight of hand": "dex", stealth: "dex", survival: "wis",
};

const ABILITY_CAP = 20;
export const modOf = (score: number) => Math.floor((score - 10) / 2);

/** Base + trasfondo + mejoras de característica (`asi`) del historial, con tope de 20. */
export function abilityScores(sheet: Dnd2024SheetV2): AbilityScores {
  const bonus: Partial<Record<Ability, number>> = { ...sheet.background.abilities };
  for (const l of sheet.levels) {
    for (const c of l.choices) {
      if (c.type !== "asi" || !("abilities" in c.value)) continue;
      for (const [a, v] of Object.entries(c.value.abilities) as [Ability, number][]) bonus[a] = (bonus[a] ?? 0) + v;
    }
  }
  const scores = {} as AbilityScores;
  for (const a of ABILITIES) {
    const score = Math.min(ABILITY_CAP, sheet.baseAbilities[a] + (bonus[a] ?? 0));
    scores[a] = { score, mod: modOf(score) };
  }
  return scores;
}

export function saveRows(abilities: AbilityScores, proficient: Ability[], profBonus: number): SaveRow[] {
  return ABILITIES.map((ability) => {
    const p = proficient.includes(ability);
    return { ability, proficient: p, total: abilities[ability].mod + (p ? profBonus : 0) };
  });
}

/** `proficient`: ids con competencia; `expertise`: ids con pericia (bonificador doble). */
export function skillRows(
  abilities: AbilityScores, proficient: string[], expertise: string[], profBonus: number,
): SkillRow[] {
  const has = (list: string[], id: string) => list.some((s) => s.toLowerCase() === id);
  return Object.entries(SKILL_ABILITIES).map(([id, ability]) => {
    const proficiency: 0 | 1 | 2 = has(expertise, id) ? 2 : has(proficient, id) ? 1 : 0;
    return { id, ability, proficiency, total: abilities[ability].mod + proficiency * profBonus };
  });
}
