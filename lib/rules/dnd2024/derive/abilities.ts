// Características, salvaciones y habilidades de la hoja v2.
import { heldFeats } from "@/lib/rules/dnd2024/levels";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet";
import { ABILITIES, type Ability, type Ref } from "@/lib/rules/types";

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
// Los dones épicos pueden subir una característica hasta 30
const EPIC_CAP = 30;
export const modOf = (score: number) => Math.floor((score - 10) / 2);

/**
 * Base + trasfondo + mejoras de característica (`asi`) y +1 de las dotes del historial, con tope de 20; después, el +1
 * de los dones épicos (`isEpicBoon`), con tope de 30. Las dotes sustituidas no cuentan.
 */
export function abilityScores(sheet: Dnd2024SheetV2, isEpicBoon: (feat: Ref) => boolean = () => false): AbilityScores {
  const bonus: Partial<Record<Ability, number>> = { ...sheet.background.abilities };
  const epic: Partial<Record<Ability, number>> = {};
  const add = (to: Partial<Record<Ability, number>>, a: Ability, v: number) => { to[a] = (to[a] ?? 0) + v; };
  for (const l of sheet.levels) {
    for (const c of l.choices) {
      if (c.type !== "asi") continue;
      if ("abilities" in c.value) {
        for (const [a, v] of Object.entries(c.value.abilities) as [Ability, number][]) add(bonus, a, v);
      } else if (c.value.ability) add(isEpicBoon(c.value.feat.ref) ? epic : bonus, c.value.ability, 1);
    }
  }
  for (const f of heldFeats(sheet.levels)) if (f.ability) add(isEpicBoon(f.ref) ? epic : bonus, f.ability, 1);
  const scores = {} as AbilityScores;
  for (const a of ABILITIES) {
    const regular = Math.min(ABILITY_CAP, sheet.baseAbilities[a] + (bonus[a] ?? 0));
    const score = Math.min(EPIC_CAP, regular + (epic[a] ?? 0));
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
