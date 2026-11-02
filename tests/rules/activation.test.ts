import { afterEach, describe, expect, test } from "vitest";
import { ACTIVATION_OVERRIDES, activationFor, featureActivation } from "@/lib/rules/import/activation";
import { normalizeClassFeature, normalizeSubclassFeature, type NormalizeContext } from "@/lib/rules/import/normalize";
import type { FeatureData } from "@/lib/rules/types";

// Entradas reales del XPHB (class-*.json de 5etools), recortadas a lo que importa
const secondWind = [
  "You have a limited well of physical and mental stamina that you can draw on. As a {@variantrule Bonus Action|XPHB}, you can use it to regain {@variantrule Hit Points|XPHB} equal to {@dice 1d10} plus your Fighter level.",
  "You can use this feature twice. You regain one expended use when you finish a {@variantrule Short Rest|XPHB}.",
];
const rage = [
  "You can imbue yourself with a primal power called Rage. You can enter it as a {@variantrule Bonus Action|XPHB} if you aren't wearing Heavy armor.",
  { type: "entries", entries: [{ type: "entries", name: "Damage Resistance", entries: ["You have {@variantrule Resistance|XPHB} to Bludgeoning damage."] }] },
];
const uncannyDodge = [
  "When an attacker that you can see hits you with an attack roll, you can take a {@variantrule Reaction|XPHB} to halve the attack's damage against you (round down).",
];
const arcaneRecovery = [
  "You can regain some of your magical energy by studying your spellbook. When you finish a {@variantrule Short Rest|XPHB}, you can choose expended spell slots to recover.",
  "Once you use this feature, you can't do so again until you finish a {@variantrule Long Rest|XPHB}.",
];
const spellcasting = [
  "As a student of arcane magic, you have learned to cast spells. See {@book chapter 7|XPHB|7} for the rules on spellcasting.",
  { type: "entries", entries: [{ type: "entries", name: "Cantrips", entries: ["You know three Wizard cantrips of your choice. {@spell Light|XPHB} is recommended."] }] },
];

describe("featureActivation", () => {
  test("acción adicional, reacción y pasivos con texto real", () => {
    expect(featureActivation(secondWind)).toBe("bonus");
    expect(featureActivation(rage)).toBe("bonus");
    expect(featureActivation(uncannyDodge)).toBe("reaction");
    expect(featureActivation(arcaneRecovery)).toBeUndefined();
    expect(featureActivation(spellcasting)).toBeUndefined();
  });

  test("acción: Magic action, as an action, Attack action", () => {
    expect(featureActivation(["You can take a {@action Magic|XPHB} action to cast a spell."])).toBe("action");
    expect(featureActivation(["As an action, you can heal."])).toBe("action");
    expect(featureActivation(["When you take the {@action Attack|XPHB} action"])).toBe("action");
  });

  test("no confunde menciones de otro rasgo", () => {
    expect(featureActivation(["You can't take Reactions while Raging."])).toBeUndefined();
    expect(featureActivation([{ type: "list", items: ["You can use your Reaction to parry."] }])).toBe("reaction");
    expect(featureActivation(undefined)).toBeUndefined();
  });
});

describe("activationFor", () => {
  afterEach(() => {
    delete ACTIVATION_OVERRIDES["classFeature:prueba|fighter|xphb|1"];
  });

  test("sin corrección usa el texto", () => {
    expect(activationFor("classFeature:prueba|fighter|xphb|1", secondWind)).toBe("bonus");
  });

  test("una corrección gana sobre el texto y null fuerza pasivo", () => {
    ACTIVATION_OVERRIDES["classFeature:prueba|fighter|xphb|1"] = "reaction";
    expect(activationFor("classFeature:prueba|fighter|xphb|1", secondWind)).toBe("reaction");
    ACTIVATION_OVERRIDES["classFeature:prueba|fighter|xphb|1"] = null;
    expect(activationFor("classFeature:prueba|fighter|xphb|1", secondWind)).toBeUndefined();
  });
});

describe("normalización", () => {
  test("el rasgo de clase guarda su activación", () => {
    const raw = { name: "Second Wind", source: "XPHB", className: "Fighter", classSource: "XPHB", level: 1, entries: secondWind };
    expect((normalizeClassFeature(raw).data as FeatureData).activation).toBe("bonus");
    const passive = { ...raw, name: "Arcane Recovery", entries: arcaneRecovery };
    expect("activation" in (normalizeClassFeature(passive).data as FeatureData)).toBe(false);
  });
});

describe("normalización de rasgos de subclase", () => {
  const berserker = { className: "Barbarian", classSource: "XPHB", subclassShortName: "Berserker", subclassSource: "XPHB", source: "XPHB" };
  const ctx = { subclasses: new Map() } as unknown as NormalizeContext;

  test("guarda la activación deducida del texto (Presencia intimidante)", () => {
    const raw = { ...berserker, name: "Intimidating Presence", level: 14,
      entries: ["As a {@variantrule Bonus Action|XPHB}, you can strike terror into others with your menacing presence and primal power."] };
    expect((normalizeSubclassFeature(raw, ctx).data as FeatureData).activation).toBe("bonus");
  });

  test("Frenzy, sin acción, queda pasivo", () => {
    const raw = { ...berserker, name: "Frenzy", level: 3, entries: ["If you use Reckless Attack while your Rage is active, you deal extra damage."] };
    expect("activation" in (normalizeSubclassFeature(raw, ctx).data as FeatureData)).toBe(false);
  });

  test("una corrección de subclase fuerza pasivo (Paso veloz, cita una acción adicional ajena)", () => {
    const raw = { name: "Fleet Step", source: "XPHB", className: "Monk", classSource: "XPHB", subclassShortName: "Open Hand",
      subclassSource: "XPHB", level: 11,
      entries: ["When you take a {@variantrule Bonus Action|XPHB} other than Step of the Wind, you can also use Step of the Wind immediately after that {@variantrule Bonus Action|XPHB}."] };
    expect(featureActivation(raw.entries)).toBe("bonus"); // el texto solo diría «bonus»
    const e = normalizeSubclassFeature(raw, ctx);
    expect(e.key).toBe("subclassFeature:fleet step|monk|xphb|open hand|xphb|11");
    expect("activation" in (e.data as FeatureData)).toBe(false);
  });

  test("mención incidental de una acción adicional no activa", () => {
    expect(featureActivation(["The target can't use Reactions, and its Bonus Actions end while Frightened."])).toBeUndefined();
  });
});
