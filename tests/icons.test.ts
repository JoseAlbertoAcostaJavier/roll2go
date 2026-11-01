import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { iconSrc } from "@/lib/utils/icons";

const onDisk = (src: string | null) => !!src && existsSync(path.join(process.cwd(), "public", src));

describe("iconSrc", () => {
  it("rutas públicas", () => {
    expect(iconSrc("class", "wizard")).toBe("/assets/icons/classes/wizard.svg");
    expect(iconSrc("school", "V")).toBe("/assets/icons/schools/evocation.svg");
    expect(iconSrc("school", "X")).toBeNull();
    expect(iconSrc("species", "elf")).toBe("/assets/icons/species/elf.png");
    expect(iconSrc("status", "retired")).toBe("/assets/icons/status/retired.svg");
    expect(iconSrc("class", "")).toBeNull();
  });

  it("los archivos de las clases, escuelas, especies y estados del Manual 2024 existen", () => {
    const classes = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];
    const species = ["dragonborn", "dwarf", "elf", "gnome", "goliath", "halfling", "human", "orc", "tiefling"];
    for (const c of classes) expect(onDisk(iconSrc("class", c)), c).toBe(true);
    for (const s of "ACDEVINT") expect(onDisk(iconSrc("school", s)), s).toBe(true);
    for (const s of species) expect(onDisk(iconSrc("species", s)), s).toBe(true);
    for (const s of ["active", "retired", "dead", "npc"]) expect(onDisk(iconSrc("status", s)), s).toBe(true);
  });
});

describe("iconos de grupos de rasgos", () => {
  it("existen y tienen su ruta", () => {
    for (const f of ["feats", "invocations", "others", "weapon-mastery"]) {
      expect(iconSrc("feature", f)).toBe(`/assets/icons/features/${f}.svg`);
      expect(onDisk(iconSrc("feature", f)), f).toBe(true);
    }
  });
});

describe("iconos oscuros (máscara)", () => {
  it("rutas públicas", () => {
    expect(iconSrc("damageType", "fire")).toBe("/assets/icons/dark/damage-types/fire.svg");
    expect(iconSrc("weaponType", "melee")).toBe("/assets/icons/dark/weapon-types/melee.svg");
    expect(iconSrc("weaponType", "ranged")).toBe("/assets/icons/dark/weapon-types/ranged.svg");
    expect(iconSrc("darkSchool", "V")).toBe("/assets/icons/dark/schools/evocation.svg");
    expect(iconSrc("action", "opportunity-attack")).toBe("/assets/icons/dark/actions/opportunity-attack.svg");
    expect(iconSrc("condition", "blinded")).toBe("/assets/icons/dark/conditions/blinded.svg");
    expect(iconSrc("environment", "bright-light")).toBe("/assets/icons/dark/environment/bright-light.svg");
  });

  it("los archivos existen", () => {
    const damage = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
    const conditions = ["blinded", "charmed", "deafened", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious", "exhaustion"];
    const actions = ["attack", "cast-spell", "climb", "communicate", "concentration", "dash", "disengage", "dodge", "drop-prone", "escape", "grapple", "help", "hide", "improvise", "move", "offhand-attack", "opportunity-attack", "quick-interaction", "ready-action", "search", "shove", "stand-up", "use-shield"];
    for (const d of damage) expect(onDisk(iconSrc("damageType", d)), d).toBe(true);
    for (const s of "ACDEVINT") expect(onDisk(iconSrc("darkSchool", s)), s).toBe(true);
    for (const w of ["melee", "ranged"]) expect(onDisk(iconSrc("weaponType", w)), w).toBe(true);
    for (const c of conditions) expect(onDisk(iconSrc("condition", c)), c).toBe(true);
    for (const a of actions) expect(onDisk(iconSrc("action", a)), a).toBe(true);
    for (const e of ["bright-light", "darkness"]) expect(onDisk(iconSrc("environment", e)), e).toBe(true);
  });

  it("ids desconocidos dan null", () => {
    expect(iconSrc("damageType", "banana")).toBeNull();
    expect(iconSrc("weaponType", "banana")).toBeNull();
    expect(iconSrc("darkSchool", "X")).toBeNull();
    expect(iconSrc("action", "banana")).toBeNull();
    expect(iconSrc("condition", "banana")).toBeNull();
    expect(iconSrc("environment", "banana")).toBeNull();
    expect(iconSrc("damageType", "")).toBeNull();
  });
});
