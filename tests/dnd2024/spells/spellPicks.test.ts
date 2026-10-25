import { describe, expect, it } from "vitest";
import type { PendingChoice } from "@/lib/rules/dnd2024/levels/pendingChoices";
import {
  bonusChoiceOf, bonusPickMissing, emptySpellPick, featSpellsChoiceOf, featSpellsMissing, parseSpellPick, spellChoiceOf,
  spellPickMissing,
} from "@/lib/rules/dnd2024/spells/spellPicks";

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
  it("recupera las entradas gratis y la lista elegida", () => {
    expect(parseSpellPick({ free: [k("shield"), 2], list: "druid" })).toMatchObject({ free: [k("shield")], list: "druid" });
    expect(parseSpellPick({ free: [], list: 3 })).not.toHaveProperty("list");
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

describe("spellChoiceOf con Sabio de la escuela", () => {
  it("envía de 0 a `count` entradas gratis", () => {
    const p = pending({ mode: "spellbook", cantrips: 0, spells: 2, free: { count: 2, school: "A", maxLevel: 2 } });
    const pick = { ...emptySpellPick(), spells: [k("sleep"), k("shield")] };
    expect(spellPickMissing(p, pick)).toBeNull();
    expect(spellChoiceOf(p, pick)?.value).toMatchObject({ free: [] });
    expect(spellChoiceOf(p, { ...pick, free: [k("alarm"), k("armor"), k("x")] })?.value)
      .toMatchObject({ free: [named("alarm"), named("armor")] });
  });
});

const INITIATE = { book: "b", key: "feat:magic initiate|xphb" };
const featPending = (extra: Partial<PendingChoice> = {}): PendingChoice => ({
  type: "featSpells", source: "featSpells:feat:magic initiate|xphb", count: 3, label: "Conjuros de Iniciado",
  spells: { class: INITIATE, mode: "levelUp", list: "", cantrips: 2, spells: 1, maxLevel: 1 },
  featSpells: { feat: INITIATE, lists: ["cleric", "druid", "wizard"], abilities: ["int", "wis", "cha"] },
  ...extra,
});

describe("featSpells", () => {
  it("pide primero la lista y después los conjuros y la característica", () => {
    const pick = { ...emptySpellPick(), cantrips: [k("light"), k("guidance")], spells: [k("bless")] };
    expect(featSpellsMissing(featPending(), pick, "wis")).toBe("elegir la lista de conjuros");
    expect(featSpellsMissing(featPending(), { ...pick, list: "cleric" }, "")).toBe("elegir la característica de lanzamiento");
    expect(featSpellsMissing(featPending(), { ...pick, list: "cleric" }, "wis")).toBeNull();
    expect(featSpellsChoiceOf(featPending(), { ...pick, list: "cleric" }, "wis")?.value).toMatchObject({ list: "cleric", ability: "wis" });
    // Una lista que la dote no ofrece no se envía
    expect(featSpellsChoiceOf(featPending(), { ...pick, list: "bard" }, "wis")?.value).not.toHaveProperty("list");
  });
  it("con solo el cambio opcional: sin cambio no se envía; con él, solo el cambio", () => {
    const p = featPending({
      count: 0, optionalReplace: true,
      spells: { class: INITIATE, mode: "levelUp", list: "", cantrips: 0, spells: 0, maxLevel: 0 },
      featSpells: { feat: INITIATE },
    });
    expect(featSpellsMissing(p, emptySpellPick(), "")).toBeNull();
    expect(featSpellsChoiceOf(p, emptySpellPick(), "")).toBeNull();
    const swap = { ...emptySpellPick(), replace: { out: k("bless"), in: "" } };
    expect(featSpellsMissing(p, swap, "")).toBe("elegir el conjuro que entra");
    expect(featSpellsChoiceOf(p, { ...swap, replace: { out: k("bless"), in: k("sleep") } }, "")).toEqual({
      type: "featSpells", source: p.source,
      value: { feat: INITIATE, cantrips: [], spells: [], replace: { out: named("bless"), in: named("sleep") } },
    });
  });
});

describe("arcanum y bonusSpells", () => {
  const arcanum = (extra: Partial<PendingChoice> = {}): PendingChoice => ({
    type: "arcanum", source: "classFeature:mystic arcanum|warlock|xphb|11", count: 1, label: "Arcano místico",
    arcanum: { level: 6, list: "warlock" }, ...extra,
  });
  it("pide el arcano y lo envía como valor; la sustitución, aparte", () => {
    expect(bonusPickMissing(arcanum(), undefined)).toBe("elegir 1 conjuro en Arcano místico");
    const pick = { ...emptySpellPick(), spells: [k("eyebite")] };
    expect(bonusChoiceOf(arcanum(), pick)).toEqual({ type: "arcanum", source: arcanum().source, value: named("eyebite") });
  });
  it("sin arcano nuevo: solo se envía si se sustituye uno", () => {
    const p = arcanum({ count: 0, optionalReplace: true, arcanum: { list: "warlock" } });
    expect(bonusPickMissing(p, undefined)).toBeNull();
    expect(bonusChoiceOf(p, emptySpellPick())).toBeNull();
    expect(bonusChoiceOf(p, { ...emptySpellPick(), replace: { out: k("eyebite"), in: k("mass suggestion") } })).toEqual({
      type: "arcanum", source: p.source, value: null, replace: { out: named("eyebite"), in: named("mass suggestion") },
    });
  });
  it("bonusSpells: exactamente `count`, con la sustitución opcional", () => {
    const p: PendingChoice = {
      type: "bonusSpells", source: "classFeature:magical discoveries|bard|xphb|lore|xphb|6", count: 2,
      label: "Descubrimientos mágicos", optionalReplace: true,
      bonusSpells: { class: SORCERER, lists: ["cleric", "druid", "wizard"], maxLevel: 3, origin: "Descubrimientos mágicos" },
    };
    expect(bonusPickMissing(p, { ...emptySpellPick(), spells: [k("bless")] })).toBe("elegir 1 conjuro en Descubrimientos mágicos");
    expect(bonusChoiceOf(p, { ...emptySpellPick(), spells: [k("bless"), k("cure wounds"), k("x")] })).toEqual({
      type: "bonusSpells", source: p.source, value: { spells: [named("bless"), named("cure wounds")] },
    });
  });
});
