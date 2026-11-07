import { describe, expect, it } from "vitest";
import { AVATAR_TONES, avatarTone, initialsOf } from "@/lib/utils/initials";

describe("initialsOf", () => {
  it("usa la inicial de las dos primeras palabras", () => {
    expect(initialsOf("Theren Teinithra")).toBe("TT");
    expect(initialsOf("Kael de la Prueba")).toBe("KD");
  });
  it("con una sola palabra, sus dos primeras letras", () => {
    expect(initialsOf("Sheggen")).toBe("SH");
    expect(initialsOf("Óscar")).toBe("ÓS");
  });
  it("ignora espacios de más y soporta nombres vacíos", () => {
    expect(initialsOf("  Elara   Prueba ")).toBe("EP");
    expect(initialsOf("   ")).toBe("?");
  });
  it("no parte caracteres fuera del plano básico", () => {
    expect(initialsOf("🐉 Dragón")).toBe("🐉D");
  });
});

describe("avatarTone", () => {
  it("es estable y sale de la lista", () => {
    expect(avatarTone("Elara")).toBe(avatarTone("Elara"));
    expect(AVATAR_TONES).toContain(avatarTone("Borin"));
    expect(AVATAR_TONES).toContain(avatarTone(""));
  });
});
