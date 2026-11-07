import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classGlyphSrc } from "@/lib/utils/icons";

const CLASSES = ["artificer", "barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];

describe("classGlyphSrc", () => {
  it("cada clase apunta a un archivo que existe", () => {
    for (const id of CLASSES) {
      const src = classGlyphSrc(id)!;
      expect(existsSync(join("public", decodeURI(src)))).toBe(true);
    }
  });

  it("la ruta va codificada: sirve dentro de url() de la máscara", () => {
    expect(classGlyphSrc("wizard")).toBe("/assets/icons/classes/no-background/Class%20Icon%20-%20Wizard.svg");
  });

  it("sin icono para una clase desconocida o sin clase", () => {
    expect(classGlyphSrc("homebrew")).toBeNull();
    expect(classGlyphSrc(null)).toBeNull();
  });
});
