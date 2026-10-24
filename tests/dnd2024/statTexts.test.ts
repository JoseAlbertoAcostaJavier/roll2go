import { describe, expect, it } from "vitest";
import { SKILL_ABILITIES } from "@/lib/rules/dnd2024/derive/abilities";
import {
  ABILITY_TEXTS, AC_TEXT, INITIATIVE_TEXT, partText, saveText, SKILL_TEXTS, SPEED_TEXT, totalText,
} from "@/lib/rules/dnd2024/statTexts";
import { ABILITIES } from "@/lib/rules/types";

describe("textos de la pestaña Información", () => {
  it("tiene un texto para cada una de las 18 habilidades y ninguno más", () => {
    expect(Object.keys(SKILL_TEXTS).sort()).toEqual(Object.keys(SKILL_ABILITIES).sort());
    for (const text of Object.values(SKILL_TEXTS)) expect(text.trim()).not.toBe("");
  });

  it("tiene un texto para cada característica", () => {
    expect(Object.keys(ABILITY_TEXTS).sort()).toEqual([...ABILITIES].sort());
    for (const text of Object.values(ABILITY_TEXTS)) expect(text.trim()).not.toBe("");
  });

  it("nombra la característica en el texto de la salvación", () => {
    expect(saveText("dex")).toContain("Destreza");
    expect(saveText("wis")).toContain("Sabiduría");
  });

  it("tiene textos de CA, iniciativa y velocidad", () => {
    for (const text of [AC_TEXT, INITIATIVE_TEXT, SPEED_TEXT]) expect(text.trim()).not.toBe("");
  });
});

describe("valores del desglose", () => {
  it("modificadores: todas las filas con signo", () => {
    expect(partText(2, 0)).toBe("+2");
    expect(partText(-1, 1)).toBe("−1");
    expect(totalText(0)).toBe("+0");
  });

  it("puntuación y CA: la primera fila y el total sin signo, el resto con signo", () => {
    expect(partText(15, 0, "plain")).toBe("15");
    expect(partText(2, 1, "plain")).toBe("+2");
    expect(partText(-3, 2, "plain")).toBe("−3");
    expect(totalText(17, "plain")).toBe("17");
  });

  it("velocidad: la base sin signo, los bonificadores con signo y el total con metros", () => {
    expect(partText(30, 0, "feet")).toBe("30 pies");
    expect(partText(10, 1, "feet")).toBe("+10 pies");
    expect(totalText(40, "feet")).toBe("40 pies (12 m)");
  });
});
