import { describe, expect, it } from "vitest";
import type { PendingChoice } from "@/lib/rules/dnd2024/levels";
import { emptySpellPick, parseSpellPick, spellChoiceOf, spellPickMissing } from "@/lib/rules/dnd2024/spellPicks";

const SORCERER = { book: "b", key: "class:sorcerer|xphb" };
const pending = (over: Partial<NonNullable<PendingChoice["spells"]>> = {}, extra: Partial<PendingChoice> = {}): PendingChoice => {
  const spells = { class: SORCERER, mode: "levelUp" as const, list: "sorcerer", cantrips: 1, spells: 2, maxLevel: 1, ...over };
  return {
    type: "spells", source: "progression:spells|sorcerer|xphb", count: spells.cantrips + spells.spells, label: "Conjuros",
    spells, ...extra,
  };
};
const k = (name: string) => `b:spell:${name}|xphb`;
const named = (name: string) => ({ ref: { book: "b", key: `spell:${name}|xphb` }, name: "" });

describe("parseSpellPick", () => {
  it("recupera lo marcado y descarta lo que no encaja", () => {
    expect(parseSpellPick(null)).toEqual(emptySpellPick());
    expect(parseSpellPick({ cantrips: [k("light"), 3, k("light"), ""], spells: "x", replace: { out: k("a"), in: 1 } }))
      .toEqual({ cantrips: [k("light")], spells: [], replace: { out: k("a"), in: "" }, replaceCantrip: { out: "", in: "" } });
  });
});

describe("spellPickMissing", () => {
  it("pide los trucos y los conjuros que faltan", () => {
    expect(spellPickMissing(pending(), undefined)).toBe("elegir 1 truco");
    expect(spellPickMissing(pending(), { ...emptySpellPick(), cantrips: [k("light")] })).toBe("elegir 2 conjuros");
    expect(spellPickMissing(pending({ mode: "spellbook", cantrips: 0 }), { ...emptySpellPick(), spells: [k("sleep")] }))
      .toBe("elegir 1 conjuro para el libro");
    expect(spellPickMissing(pending(), { ...emptySpellPick(), cantrips: [k("light")], spells: [k("sleep"), k("shield")] })).toBeNull();
  });
  it("una sustitución a medias falta por completar; sin sustituir, no", () => {
    const done = { ...emptySpellPick(), cantrips: [k("light")], spells: [k("sleep"), k("shield")] };
    const p = pending({}, { optionalReplace: true, optionalReplaceCantrip: true });
    expect(spellPickMissing(p, done)).toBeNull();
    expect(spellPickMissing(p, { ...done, replace: { out: k("sleep"), in: "" } })).toBe("elegir el conjuro que entra");
    expect(spellPickMissing(p, { ...done, replaceCantrip: { out: "", in: k("mage hand") } })).toBe("elegir el truco que sale");
  });
});

describe("spellChoiceOf", () => {
  it("envía los elegidos y las dos sustituciones de la misma subida", () => {
    const p = pending({}, { optionalReplace: true, optionalReplaceCantrip: true });
    const choice = spellChoiceOf(p, {
      cantrips: [k("light")], spells: [k("sleep"), k("shield")],
      replace: { out: k("magic missile"), in: k("grease") }, replaceCantrip: { out: k("prestidigitation"), in: k("mage hand") },
    });
    expect(choice).toEqual({
      type: "spells", source: "progression:spells|sorcerer|xphb",
      value: {
        class: SORCERER, cantrips: [named("light")], spells: [named("sleep"), named("shield")],
        replace: { out: named("magic missile"), in: named("grease") },
        replaceCantrip: { out: named("prestidigitation"), in: named("mage hand") },
      },
    });
  });
  it("no envía sustituciones que el nivel no permite ni a medias, y recorta lo que sobra", () => {
    const choice = spellChoiceOf(pending(), {
      cantrips: [k("light"), k("mage hand")], spells: [k("sleep"), k("shield")],
      replace: { out: k("magic missile"), in: k("grease") }, replaceCantrip: { out: k("prestidigitation"), in: "" },
    });
    expect(choice?.value).toEqual({ class: SORCERER, cantrips: [named("light")], spells: [named("sleep"), named("shield")] });
    // El Mago no sustituye conjuros de su libro
    const wizard = pending({ mode: "spellbook", cantrips: 0 }, { optionalReplace: true });
    expect(spellChoiceOf(wizard, { ...emptySpellPick(), spells: [k("sleep"), k("shield")], replace: { out: k("a"), in: k("b") } })?.value)
      .not.toHaveProperty("replace");
  });
  it("sin nada nuevo y sin sustituir, no se envía", () => {
    const p = pending({ cantrips: 0, spells: 0 }, { count: 0, optionalReplaceCantrip: true });
    expect(spellChoiceOf(p, emptySpellPick())).toBeNull();
    expect(spellChoiceOf(p, { ...emptySpellPick(), replaceCantrip: { out: k("a"), in: k("b") } })?.value)
      .toMatchObject({ replaceCantrip: { out: named("a"), in: named("b") } });
  });
});
