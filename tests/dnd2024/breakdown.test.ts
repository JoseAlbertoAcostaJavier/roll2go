import { describe, expect, it } from "vitest";
import { derive } from "@/lib/rules/dnd2024/derive";
import {
  abilityBreakdowns, abilityScores, saveBreakdowns, SKILL_ABILITIES, skillBreakdowns, skillRows,
} from "@/lib/rules/dnd2024/derive/abilities";
import { makeBreakdown, type Breakdown } from "@/lib/rules/dnd2024/derive/breakdown";
import type { Choice, Dnd2024Sheet, Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet";
import { upgradeSheet } from "@/lib/rules/dnd2024/upgrade";
import { ABILITIES, type Ability, type Ref } from "@/lib/rules/types";
import { B, buildCatalog, ref } from "./fixtureCatalog";

const entries = buildCatalog(["class-barbarian.json", "class-fighter.json"]);
// No hay fixture del Bardo: basta una entrada de clase con su clave
entries.set(`${B}:class:bard|xphb`, {
  ...entries.get(`${B}:class:barbarian|xphb`)!, ref: ref("class:bard|xphb"), name: "Bard",
});

const v1 = (): Dnd2024Sheet => ({
  version: 1,
  species: { ref: ref("species:elf|xphb"), name: "Elfo" },
  lineage: { ref: ref("lineage:drow|xphb"), name: "Drow" },
  background: { ref: ref("background:acolyte|xphb"), name: "Acólito", abilities: { wis: 2, int: 1 }, equipment: "A" },
  classes: [{
    ref: ref("class:barbarian|xphb"), name: "Bárbaro", level: 1, subclass: null,
    skills: ["athletics", "intimidation"], equipment: "A",
  }],
  abilityMethod: "standard",
  baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  rolls: null,
  speciesChoices: { skills: ["perception"], size: null },
  alignment: "", appearance: "", age: "", languages: "", notes: "", xp: 0,
  hp: { max: null, current: null, temp: 0 },
});

// Bárbaro 1 y después `[clase, niveles]`; `choices` por nivel total
const build = (more: [string, number][] = [], choices: Record<number, Choice[]> = {}): Dnd2024SheetV2 => {
  let i = 0;
  const s = upgradeSheet(v1(), entries, () => `id${++i}`);
  const perClass = new Map<string, number>([["barbarian", 1]]);
  for (const [name, count] of more) {
    for (let k = 0; k < count; k++) {
      const classLevel = (perClass.get(name) ?? 0) + 1;
      perClass.set(name, classLevel);
      const n = s.levels.length + 1;
      s.levels.push({
        n, class: { ref: ref(`class:${name}|xphb`), name }, classLevel, hp: { method: "average", value: 5 },
        choices: choices[n] ?? [],
      });
    }
  }
  return s;
};

const sum = (b: Breakdown) => b.parts.reduce((t, p) => t + p.value, 0);
const asi = (abilities: Partial<Record<Ability, 1 | 2>>): Choice => ({ type: "asi", source: "x", value: { abilities } });
const featAsi = (key: string, name: string, ability: Ability): Choice =>
  ({ type: "asi", source: "x", value: { feat: { ref: ref(key), name }, ability } });
const noEpic = () => false;
const nameOf = (_r: Ref, fallback: string) => fallback;

describe("makeBreakdown", () => {
  it("suma las partes", () => {
    expect(makeBreakdown([{ label: "A", value: 2 }, { label: "B", value: -1 }]).total).toBe(1);
  });
});

describe("desglose de características", () => {
  it("base, trasfondo y mejora de nivel 4, sin tope", () => {
    const s = build([["barbarian", 3]], { 4: [asi({ str: 2 })] });
    s.background.abilities = { str: 2 };
    const b = abilityBreakdowns(s, noEpic, nameOf).str;
    expect(b.parts).toEqual([
      { label: "Puntuación base", value: 15 },
      { label: "Trasfondo", value: 2 },
      { label: "Mejora de característica (nivel 4)", value: 2 },
    ]);
    expect(b.total).toBe(19);
    expect(b.notes).toEqual(["Modificador +4"]);
  });
  it("por encima de 20: la parte «Máximo 20» compensa", () => {
    const s = build([["barbarian", 3]], { 4: [asi({ str: 2 })] });
    s.baseAbilities.str = 17;
    s.background.abilities = { str: 2 };
    const b = abilityBreakdowns(s, noEpic, nameOf).str;
    expect(b.parts).toContainEqual({ label: "Máximo 20", value: -1 });
    expect(b.total).toBe(20);
    expect(sum(b)).toBe(20);
    expect(abilityScores(s).str.score).toBe(20);
  });
  it("dotes con +1 y dones épicos por encima de 20, con tope de 30", () => {
    const epicLevels: Record<number, Choice[]> = { 4: [featAsi("feat:gwm|xphb", "Gran maestro de armas", "str")] };
    for (let n = 5; n <= 16; n++) epicLevels[n] = [featAsi(`feat:boon ${n}|xphb`, `Don ${n}`, "str")];
    const s = build([["barbarian", 15]], epicLevels);
    s.baseAbilities.str = 19;
    const isEpic = (r: Ref) => r.key.startsWith("feat:boon");
    const b = abilityBreakdowns(s, isEpic, nameOf).str;
    expect(b.parts.slice(0, 3)).toEqual([
      { label: "Puntuación base", value: 19 },
      { label: "Dote: Gran maestro de armas", value: 1 },
      { label: "Don épico: Don 5", value: 1 },
    ]);
    expect(b.parts).not.toContainEqual(expect.objectContaining({ label: "Máximo 20" }));
    expect(b.parts.at(-1)).toEqual({ label: "Máximo 30", value: -2 });
    expect(b.total).toBe(30);
    expect(sum(b)).toBe(30);
    expect(abilityScores(s, isEpic).str.score).toBe(30);
  });
  it("los dones épicos se suman tras el tope de 20", () => {
    const s = build([["barbarian", 4]], { 4: [asi({ str: 2 })], 5: [featAsi("feat:boon|xphb", "Don", "str")] });
    s.baseAbilities.str = 20;
    const b = abilityBreakdowns(s, (r) => r.key === "feat:boon|xphb", nameOf).str;
    expect(b.parts).toEqual([
      { label: "Puntuación base", value: 20 },
      { label: "Mejora de característica (nivel 4)", value: 2 },
      { label: "Máximo 20", value: -2 },
      { label: "Don épico: Don", value: 1 },
    ]);
    expect(b.total).toBe(21);
  });
  it("derive: el total coincide con la puntuación en todos los personajes de prueba", () => {
    const sheets = [
      build(),
      build([["barbarian", 3]], { 4: [asi({ str: 2 })] }),
      build([["barbarian", 3]], { 4: [asi({ str: 1, dex: 1 })] }),
      build([["barbarian", 2], ["fighter", 2]], { 4: [featAsi("feat:alert|xphb", "Alert", "dex")] }),
      build([["bard", 2]]),
    ];
    for (const s of sheets) {
      const d = derive(s, entries);
      for (const a of ABILITIES) {
        expect(d.breakdowns.abilities[a].total).toBe(d.abilities[a].score);
        expect(sum(d.breakdowns.abilities[a])).toBe(d.abilities[a].score);
        expect(sum(d.breakdowns.saves[a])).toBe(d.saves.find((r) => r.ability === a)!.total);
      }
      for (const r of d.skills) expect(sum(d.breakdowns.skills[r.id])).toBe(r.total);
    }
  });
  it("derive: el nombre de la dote sale del catálogo", () => {
    const d = derive(build([["barbarian", 3]], { 4: [featAsi("feat:fey-touched|xphb", "guardado", "wis")] }), entries);
    expect(d.breakdowns.abilities.wis.parts).toContainEqual({ label: "Dote: Fey-Touched", value: 1 });
  });
});

describe("desglose de salvaciones y habilidades", () => {
  const abilities = abilityScores(build());
  it("salvación con y sin competencia", () => {
    const saves = saveBreakdowns(abilities, ["dex"], 2);
    expect(saves.dex.parts).toEqual([{ label: "Modificador de Destreza", value: 2 }, { label: "Competencia", value: 2 }]);
    expect(saves.str.parts).toEqual([{ label: "Modificador de Fuerza", value: 2 }, { label: "Sin competencia", value: 0 }]);
    expect(saves.dex.total).toBe(4);
  });
  it("habilidad con pericia: el doble de la competencia", () => {
    const skills = skillBreakdowns(abilities, ["stealth"], ["stealth"], 3, false);
    expect(skills.stealth.parts).toEqual([{ label: "Modificador de Destreza", value: 2 }, { label: "Pericia", value: 6 }]);
    expect(skills.stealth.total).toBe(8);
  });
  it("valor pasivo en Percepción, Perspicacia e Investigación", () => {
    const skills = skillBreakdowns(abilities, ["perception"], [], 2, false);
    expect(skills.perception.notes).toEqual([`Valor pasivo: ${10 + skills.perception.total}`]);
    expect(skills.insight.notes).toEqual([`Valor pasivo: ${10 + skills.insight.total}`]);
    expect(skills.investigation.notes).toEqual([`Valor pasivo: ${10 + skills.investigation.total}`]);
    for (const id of Object.keys(SKILL_ABILITIES)) {
      if (!["perception", "insight", "investigation"].includes(id)) expect(skills[id].notes).toBeUndefined();
    }
  });
  it("Polivalente: mitad de la competencia en las habilidades sin competencia", () => {
    const rows = skillRows(abilities, [], [], 3, true);
    expect(rows.find((r) => r.id === "stealth")!.total).toBe(2 + 1);
    expect(skillBreakdowns(abilities, [], [], 3, true).stealth.parts)
      .toContainEqual({ label: "Polivalente", value: 1 });
    expect(skillRows(abilities, [], [], 3).find((r) => r.id === "stealth")!.total).toBe(2);
  });

  // Sin competencia en Atletismo: se quita de las habilidades del Bárbaro
  const withoutAthletics = (s: Dnd2024SheetV2) => {
    for (const c of s.levels[0].choices) if (c.type === "skills") c.value = c.value.filter((v) => v !== "athletics");
    return s;
  };
  it("Bardo 2: Polivalente en Atletismo", () => {
    const d = derive(withoutAthletics(build([["bard", 2]])), entries);
    const pb = d.proficiencyBonus;
    const athletics = d.breakdowns.skills.athletics;
    expect(athletics.parts).toContainEqual({ label: "Polivalente", value: Math.floor(pb / 2) });
    expect(d.skills.find((s) => s.id === "athletics")!.total).toBe(d.abilities.str.mod + Math.floor(pb / 2));
    // Las habilidades con competencia no lo suman
    expect(d.breakdowns.skills.intimidation.parts).not.toContainEqual(expect.objectContaining({ label: "Polivalente" }));
  });
  it("Bardo 1 (también con Guerrero 3): sin Polivalente", () => {
    for (const more of [[["bard", 1]], [["fighter", 3], ["bard", 1]]] as [string, number][][]) {
      const d = derive(withoutAthletics(build(more)), entries);
      expect(d.breakdowns.skills.athletics.parts)
        .toEqual([{ label: "Modificador de Fuerza", value: d.abilities.str.mod }, { label: "Sin competencia", value: 0 }]);
    }
  });
});
