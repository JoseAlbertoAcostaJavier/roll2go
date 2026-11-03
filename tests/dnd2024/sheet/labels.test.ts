import { describe, expect, it } from "vitest";
import { defenseTypeName, distanceText, fmtMod, itemTypeName, rarityName, toolName } from "@/lib/rules/dnd2024/sheet/labels";

describe("toolName", () => {
  it("traduce herramientas y elecciones genéricas", () => {
    expect(toolName("calligrapher's supplies")).toBe("Suministros de calígrafo");
    expect(toolName("Thieves' Tools")).toBe("Herramientas de ladrón");
    expect(toolName("anyGamingSet")).toBe("Un juego (a elegir)");
    expect(toolName("anyArtisansTool")).toBe("Unas herramientas de artesano (a elegir)");
    expect(toolName("anyMusicalInstrument")).toBe("Un instrumento musical (a elegir)");
  });
  it("deja igual lo que no conoce", () => {
    expect(toolName("Choose one kit")).toBe("Choose one kit");
  });
});

describe("distanceText", () => {
  it("pies con su equivalencia en metros", () => {
    expect(distanceText(30)).toBe("30 pies (9 m)");
    expect(distanceText(25)).toBe("25 pies (7,5 m)");
    expect(distanceText(60)).toBe("60 pies (18 m)");
  });
});

describe("fmtMod", () => {
  it("pone signo al modificador, con «−» para los negativos", () => {
    expect(fmtMod(3)).toBe("+3");
    expect(fmtMod(0)).toBe("+0");
    expect(fmtMod(-1)).toBe("−1");
  });
});

describe("defenseTypeName", () => {
  it("tipos de daño y estados en español", () => {
    expect(defenseTypeName("resist", "poison")).toBe("Veneno");
    expect(defenseTypeName("immune", "bludgeoning")).toBe("Contundente");
    expect(defenseTypeName("conditionImmune", "frightened")).toBe("Asustado");
    expect(defenseTypeName("conditionImmune", "disease")).toBe("Enfermedad");
    expect(defenseTypeName("conditionImmune", "nonexistent")).toBe("nonexistent");
  });
});

describe("itemTypeName y rarityName", () => {
  it("traducen los códigos de tipo de 5etools", () => {
    expect(itemTypeName("M")).toBe("Arma cuerpo a cuerpo");
    expect(itemTypeName("$G")).toBe("Gema");
    expect(itemTypeName("XYZ")).toBe("Objeto");
    expect(itemTypeName("OTH")).toBe("Objeto");
  });
  it("traducen la rareza y dejan igual la desconocida", () => {
    expect(rarityName("very rare")).toBe("Muy raro");
    expect(rarityName("none")).toBe("none");
  });
});
