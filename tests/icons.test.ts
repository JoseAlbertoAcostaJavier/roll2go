import { describe, expect, it } from "vitest";
import { iconFileId, iconSrc } from "@/lib/icons";

describe("iconFileId", () => {
  it("clases: identificador en minúsculas y corrige «Babarian»", () => {
    expect(iconFileId("class", "Fighter.svg")).toBe("fighter");
    expect(iconFileId("class", "Babarian.svg")).toBe("barbarian");
  });
  it("escuelas y especies por su nombre", () => {
    expect(iconFileId("school", "evocation.svg")).toBe("evocation");
    expect(iconFileId("school", "chronurgy.svg")).toBeNull();
    expect(iconFileId("species", "Dragonborn.png")).toBe("dragonborn");
  });
  it("estados del personaje", () => {
    expect(iconFileId("status", "Active.svg")).toBe("active");
    expect(iconFileId("status", "Archived.svg")).toBe("retired");
    expect(iconFileId("status", "Dead.svg")).toBe("dead");
    expect(iconFileId("status", "NPC.svg")).toBe("npc");
    expect(iconFileId("status", "Other.svg")).toBeNull();
  });
});

describe("iconSrc", () => {
  it("rutas públicas", () => {
    expect(iconSrc("class", "wizard")).toBe("/images/classes/wizard.webp");
    expect(iconSrc("school", "V")).toBe("/images/schools/evocation.webp");
    expect(iconSrc("school", "X")).toBeNull();
    expect(iconSrc("species", "elf")).toBe("/images/species/elf.webp");
    expect(iconSrc("status", "retired")).toBe("/images/status/retired.svg");
    expect(iconSrc("class", "")).toBeNull();
  });
});
