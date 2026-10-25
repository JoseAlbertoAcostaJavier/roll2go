import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { iconSrc } from "@/lib/icons";

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
