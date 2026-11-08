import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classGlyphSrc, iconSrc, portraitSrc } from "@/lib/utils/icons";

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

  it("un nombre de varias palabras se encuentra con espacio o con guion", () => {
    for (const id of ["blood hunter", "blood-hunter"]) {
      const src = classGlyphSrc(id)!;
      expect(src).toBe("/assets/icons/classes/no-background/Class%20Icon%20-%20Blood%20Hunter.svg");
      expect(existsSync(join("public", decodeURI(src)))).toBe(true);
    }
  });

  it("una clase desconocida usa la silueta genérica; sin clase, nada", () => {
    const src = classGlyphSrc("homebrew")!;
    expect(src).toBe("/assets/icons/classes/no-background/sin-imagen.svg");
    expect(existsSync(join("public", src))).toBe(true);
    expect(classGlyphSrc(null)).toBeNull();
  });
});

describe("iconos y retratos del creador", () => {
  const onDisk = (src: string) => existsSync(join("public", src));

  it("el icono circular de una clase sin imagen es el genérico", () => {
    expect(iconSrc("class", "blood hunter")).toBe("/assets/icons/classes/blood-hunter.svg");
    expect(iconSrc("class", "apothecary")).toBe("/assets/icons/classes/no-imagen.svg");
    expect(onDisk(iconSrc("class", "apothecary")!)).toBe(true);
  });

  it("sin retrato propio se usa sin-imagen, y los genéricos existen", () => {
    expect(portraitSrc("class", "apothecary")).toBe("/assets/class-portraits/sin-imagen.webp");
    expect(portraitSrc("species", "custom lineage")).toBe("/assets/species-portraits/sin-imagen.webp");
    expect(onDisk(portraitSrc("class", "apothecary"))).toBe(true);
    expect(onDisk(portraitSrc("species", "custom lineage"))).toBe(true);
  });

  it("cada retrato conocido apunta a un archivo que existe", () => {
    for (const id of ["blood hunter", "wizard", "paladin"]) expect(onDisk(portraitSrc("class", id)), id).toBe(true);
    for (const id of ["deep gnome", "shadar-kai", "yuan-ti", "sea elf", "dragonborn", "genasi", "kender"]) {
      const src = portraitSrc("species", id);
      expect(src).not.toContain("sin-imagen");
      expect(onDisk(src), id).toBe(true);
    }
  });
});
