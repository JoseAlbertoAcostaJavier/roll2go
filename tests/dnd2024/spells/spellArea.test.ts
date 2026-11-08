import { describe, expect, it } from "vitest";
import { spellAreaInText, spellRangeParts } from "@/lib/rules/dnd2024/spells/spellArea";
import { spellAreaSrc } from "@/lib/utils/icons";

describe("área de un conjuro", () => {
  it("lee el área de la descripción, con o sin referencia a la regla", () => {
    expect(spellAreaInText("each creature in a 20-foot-radius [ref=variantrule:sphere [area of effect|xphb]]")).toEqual({ shape: "sphere", feet: 20 });
    expect(spellAreaInText("a 5-foot-radius, 40-foot-high [ref=variantrule:cylinder|xphb]")).toEqual({ shape: "cylinder", feet: 5 });
    expect(spellAreaInText("a 10-foot cube of fog")).toEqual({ shape: "cube", feet: 10 });
    expect(spellAreaInText("A storm with a 60-foot radius.")).toEqual({ shape: "radius", feet: 60 });
    expect(spellAreaInText("sheds bright light in a 30-foot radius")).toBeNull();
    expect(spellAreaInText("[ref=x]Bright Light[/ref] in a 20-foot radius")).toBeNull();
    expect(spellAreaInText("You move up to 30 feet.")).toBeNull();
  });

  it("separa el área escrita en el alcance", () => {
    expect(spellRangeParts("Personal (cono de 4,5 metros)")).toEqual({ range: "Personal", area: { shape: "cone", size: "4,5 m", name: "cono" } });
    expect(spellRangeParts("Personal (línea de 30 metros)").area?.shape).toBe("line");
    expect(spellRangeParts("Personal (radio de 3 metros)").area).toEqual({ shape: "radius", size: "3 m", name: "radio" });
    expect(spellRangeParts("Personal (esfera de 7,5 kilómetros)").area?.size).toBe("7,5 km");
  });

  it("usa la de la descripción si el alcance no la trae", () => {
    expect(spellRangeParts("45 metros (150 pies)", { shape: "sphere", feet: 20 })).toEqual({ range: "45 metros (150 pies)", area: { shape: "sphere", size: "6 m", name: "esfera" } });
    expect(spellRangeParts("Toque")).toEqual({ range: "Toque", area: null });
  });

  it("da un icono a cada forma salvo a la línea", () => {
    expect(spellAreaSrc("emanation")).toBe("/assets/icons/spell-ranges/sphere.svg");
    expect(spellAreaSrc("line")).toBeNull();
  });
});
