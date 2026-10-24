import { describe, expect, it } from "vitest";
import { SKILL_ABILITIES } from "@/lib/rules/dnd2024/derive/abilities";
import {
  ABILITY_TEXTS, AC_TEXT, INITIATIVE_TEXT, saveText, SKILL_TEXTS, SPEED_TEXT,
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
