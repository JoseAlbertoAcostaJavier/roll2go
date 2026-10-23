import { describe, expect, it } from "vitest";
import { toolName } from "@/lib/rules/dnd2024/labels";

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
