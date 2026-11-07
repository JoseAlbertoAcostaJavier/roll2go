import { describe, expect, it } from "vitest";
import { initialsOf } from "@/lib/utils/initials";

describe("initialsOf", () => {
  it("usa las dos primeras letras del nombre", () => {
    expect(initialsOf("Theren Teinithra")).toBe("TH");
    expect(initialsOf("Sheggen")).toBe("SH");
    expect(initialsOf("Óscar")).toBe("ÓS");
  });
  it("ignora espacios y soporta nombres cortos o vacíos", () => {
    expect(initialsOf("  A B ")).toBe("AB");
    expect(initialsOf("X")).toBe("X");
    expect(initialsOf("   ")).toBe("?");
  });
  it("no parte caracteres fuera del plano básico", () => {
    expect(initialsOf("🐉Dragón")).toBe("🐉D");
  });
});
