import { describe, expect, it } from "vitest";
import { blockGrants, spellHealing } from "@/lib/rules/import/normalize";

describe("blockGrants: usos por competencia", () => {
  it("el conjuro de `daily.pb` lleva uses pb; el truco conocido, no", () => {
    const grants = blockGrants([{
      innate: { "3": { daily: { pb: ["speak with animals|xphb"] } } },
      ability: { choose: ["int", "wis", "cha"] },
      known: { "1": ["minor illusion|xphb#c"] },
    }]);
    expect(grants).toHaveLength(2);
    const innate = grants.find((g) => g.level === 3)!;
    expect(innate.ref.key).toContain("speak with animals");
    expect(innate.uses).toBe("pb");
    const cantrip = grants.find((g) => g.level === 1)!;
    expect(cantrip).not.toHaveProperty("uses");
  });
  it("`daily` por nivel de conjuro no lleva uses", () => {
    const grants = blockGrants([{ innate: { "3": { daily: { "1": ["misty step|xphb"] } } } }]);
    expect(grants).toHaveLength(1);
    expect(grants[0]).not.toHaveProperty("uses");
  });
});

// Textos de 5etools-src/data/spells/spells-xphb.json (recortados)
const VP = "{@variantrule Hit Points|XPHB}";
const HEALING: [string, string, string][] = [
  ["Cure Wounds", "A creature you touch regains a number of " + VP + " equal to {@dice 2d8} plus your spellcasting ability modifier.", "2d8"],
  ["Healing Word", "A creature of your choice that you can see within range regains " + VP + " equal to {@dice 2d4} plus your spellcasting ability modifier.", "2d4"],
  ["Mass Cure Wounds", "A wave of healing energy washes out from a point you can see within range. Each target regains " + VP + " equal to {@dice 5d8} plus your spellcasting ability modifier.", "5d8"],
  ["Mass Healing Word", "Up to six creatures of your choice that you can see within range regain " + VP + " equal to {@dice 2d4} plus your spellcasting ability modifier.", "2d4"],
  ["Prayer of Healing", "Up to five creatures of your choice who remain within range for the spell's entire casting gain the benefits of a {@variantrule Short Rest|XPHB} and also regain {@dice 2d8} " + VP + ". A creature can't be affected by this spell again until that creature finishes a {@variantrule Long Rest|XPHB}.", "2d8"],
  ["Regenerate", "A creature you touch regains {@dice 4d8 + 15} " + VP + ". For the duration, the target regains 1 {@variantrule Hit Points|XPHB|Hit Point} at the start of each of its turns.", "4d8 + 15"],
  ["Aura of Vitality", "An aura radiates from you in a 30-foot {@variantrule Emanation [Area of Effect]|XPHB|Emanation} for the duration. At the start of each of your turns while it persists, you can restore {@dice 2d6} " + VP + " to one creature in it.", "2d6"],
];
const NO_HEALING: [string, unknown[]][] = [
  ["Heroes' Feast", ["You conjure a feast.", "A creature that partakes gains several benefits. Its " + VP + " maximum also increases by {@dice 2d10}, and it gains the same number of " + VP + "."]],
  ["Reincarnate", ["Roll {@dice 1d10} and consult the table below to determine the body's species.", { type: "table", colLabels: ["1d10", "Species"], rows: [["1", "{@race Aasimar|XPHB}"]] }]],
  ["Conjure Celestial", ["For each creature you can see, choose which of these lights shines on it:", { type: "list", items: [
    { type: "item", name: "Healing Light", entries: ["The target regains " + VP + " equal to {@dice 4d12} plus your spellcasting ability modifier."] },
    { type: "item", name: "Searing Light", entries: ["The target makes a Dexterity saving throw, taking {@damage 6d12} Radiant damage on a failed save."] }] }]],
  ["Wish", ["Instant Health: you allow yourself and up to twenty creatures that you can see to regain all " + VP + "."]],
];

describe("spellHealing", () => {
  it.each(HEALING)("%s: dados de curación", (_name, text, dice) => {
    expect(spellHealing({ entries: [text] })).toEqual({ dice });
  });
  it.each(NO_HEALING)("%s: sin curación", (_name, entries) => {
    expect(spellHealing({ entries })).toBeUndefined();
  });
});
