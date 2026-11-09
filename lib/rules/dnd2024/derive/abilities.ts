// Características, salvaciones y habilidades de la hoja v2, con su desglose.
import { ABILITY_NAMES, fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { heldFeats } from "@/lib/rules/dnd2024/levels/held";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import { ABILITIES, type Ability, type Ref } from "@/lib/rules/types";
import { makeBreakdown, type Breakdown, type Part } from "./breakdown";

export type AbilityScores = Record<Ability, { score: number; mod: number }>;
export type SaveRow = { ability: Ability; proficient: boolean; total: number };
export type SkillRow = { id: string; ability: Ability; proficiency: 0 | 1 | 2; total: number };

/** Las 18 habilidades con su característica (ids del catálogo, en minúsculas e inglés). */
export const SKILL_ABILITIES: Record<string, Ability> = {
  acrobatics: "dex", "animal handling": "wis", arcana: "int", athletics: "str", deception: "cha", history: "int",
  insight: "wis", intimidation: "cha", investigation: "int", medicine: "wis", nature: "int", perception: "wis",
  performance: "cha", persuasion: "cha", religion: "int", "sleight of hand": "dex", stealth: "dex", survival: "wis",
};

// Habilidades cuyo valor pasivo (10 + total) se muestra en la ficha
export const PASSIVE_SKILLS = ["perception", "insight", "investigation"];

const ABILITY_CAP = 20;
// Los dones épicos pueden subir una característica hasta 30
const EPIC_CAP = 30;
export const modOf = (score: number) => Math.floor((score - 10) / 2);
const modPart = (abilities: AbilityScores, a: Ability): Part =>
  ({ label: `Modificador de ${ABILITY_NAMES[a]}`, value: abilities[a].mod });

/**
 * Base + trasfondo + mejoras de característica (`asi`) y +1 de las dotes del historial, con tope de 20; después, el +1
 * de los dones épicos (`isEpicBoon`), con tope de 30. Las dotes sustituidas no cuentan. `nameOf` da el nombre de la
 * dote (el del catálogo o el guardado).
 */
export function abilityBreakdowns(
  sheet: Dnd2024SheetV2, isEpicBoon: (feat: Ref) => boolean, nameOf: (ref: Ref, fallback: string) => string,
): Record<Ability, Breakdown> {
  const regular = Object.fromEntries(ABILITIES.map((a) => [a, [] as Part[]])) as Record<Ability, Part[]>;
  const epic = Object.fromEntries(ABILITIES.map((a) => [a, [] as Part[]])) as Record<Ability, Part[]>;
  const featPart = (feat: { ref: Ref; name: string }, a: Ability) => {
    const isEpic = isEpicBoon(feat.ref);
    (isEpic ? epic : regular)[a].push({
      label: `${isEpic ? "Don épico" : "Dote"}: ${nameOf(feat.ref, feat.name)}`, value: 1,
    });
  };
  for (const a of ABILITIES) {
    regular[a].push({ label: "Puntuación base", value: sheet.baseAbilities[a] });
    const bg = sheet.background.abilities[a];
    if (bg) regular[a].push({ label: "Trasfondo", value: bg });
  }
  for (const l of sheet.levels) {
    for (const c of l.choices) {
      if (c.type !== "asi") continue;
      if ("abilities" in c.value) {
        for (const [a, v] of Object.entries(c.value.abilities) as [Ability, number][]) {
          if (v) regular[a].push({ label: `Mejora de característica (nivel ${l.n})`, value: v });
        }
      } else if (c.value.ability) featPart(c.value.feat, c.value.ability);
    }
  }
  for (const f of heldFeats(sheet.levels)) if (f.ability) featPart(f, f.ability);

  const out = {} as Record<Ability, Breakdown>;
  for (const a of ABILITIES) {
    const parts = [...regular[a]];
    const capped = (cap: number) => {
      const t = parts.reduce((s, p) => s + p.value, 0);
      if (t > cap) parts.push({ label: `Máximo ${cap}`, value: cap - t });
    };
    capped(ABILITY_CAP);
    parts.push(...epic[a]);
    capped(EPIC_CAP);
    const total = parts.reduce((s, p) => s + p.value, 0);
    out[a] = makeBreakdown(parts, [`Modificador ${fmtMod(modOf(total))}`]);
  }
  return out;
}

/** Puntuaciones y modificadores a partir de los desgloses de `abilityBreakdowns`. */
export const scoresFromBreakdowns = (b: Record<Ability, Breakdown>): AbilityScores =>
  Object.fromEntries(ABILITIES.map((a) => [a, { score: b[a].total, mod: modOf(b[a].total) }])) as AbilityScores;

export function abilityScores(sheet: Dnd2024SheetV2, isEpicBoon: (feat: Ref) => boolean = () => false): AbilityScores {
  return scoresFromBreakdowns(abilityBreakdowns(sheet, isEpicBoon, (_r, fallback) => fallback));
}

/** `extra`: bonificadores que valen para todas las salvaciones (objetos mágicos). */
export function saveBreakdowns(abilities: AbilityScores, proficient: Ability[], profBonus: number, extra: Part[] = []): Record<Ability, Breakdown> {
  return Object.fromEntries(ABILITIES.map((a) => [a, makeBreakdown([
    modPart(abilities, a),
    proficient.includes(a) ? { label: "Competencia", value: profBonus } : { label: "Sin competencia", value: 0 },
    ...extra,
  ])])) as Record<Ability, Breakdown>;
}

export function saveRows(abilities: AbilityScores, proficient: Ability[], profBonus: number, extra: Part[] = []): SaveRow[] {
  const b = saveBreakdowns(abilities, proficient, profBonus, extra);
  return ABILITIES.map((ability) => ({ ability, proficient: proficient.includes(ability), total: b[ability].total }));
}

const has = (list: string[], id: string) => list.some((s) => s.toLowerCase() === id);
const proficiencyIn = (proficient: string[], expertise: string[], id: string): 0 | 1 | 2 =>
  (has(expertise, id) ? 2 : has(proficient, id) ? 1 : 0);

/**
 * `proficient`: ids con competencia; `expertise`: ids con pericia (bonificador doble). `jackOfAllTrades` (Polivalente,
 * Bardo 2): la mitad del bonificador, redondeando hacia abajo, en las habilidades sin competencia.
 */
export function skillBreakdowns(
  abilities: AbilityScores, proficient: string[], expertise: string[], profBonus: number, jackOfAllTrades: boolean,
): Record<string, Breakdown> {
  return Object.fromEntries(Object.entries(SKILL_ABILITIES).map(([id, ability]) => {
    const proficiency = proficiencyIn(proficient, expertise, id);
    const second: Part = proficiency === 2 ? { label: "Pericia", value: 2 * profBonus }
      : proficiency === 1 ? { label: "Competencia", value: profBonus }
      : jackOfAllTrades ? { label: "Polivalente", value: Math.floor(profBonus / 2) }
      : { label: "Sin competencia", value: 0 };
    const parts = [modPart(abilities, ability), second];
    const total = parts.reduce((s, p) => s + p.value, 0);
    return [id, makeBreakdown(parts, PASSIVE_SKILLS.includes(id) ? [`Valor pasivo: ${10 + total}`] : undefined)];
  }));
}

export function skillRows(
  abilities: AbilityScores, proficient: string[], expertise: string[], profBonus: number, jackOfAllTrades = false,
): SkillRow[] {
  const b = skillBreakdowns(abilities, proficient, expertise, profBonus, jackOfAllTrades);
  return Object.entries(SKILL_ABILITIES).map(([id, ability]) =>
    ({ id, ability, proficiency: proficiencyIn(proficient, expertise, id), total: b[id].total }));
}
