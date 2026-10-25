import { describe, expect, it } from "vitest";
import { describeNotification, emailPrefFor, NOTIFICATION_TYPES } from "@/lib/rules/notificationText";

describe("character_level_up", () => {
  it("es un tipo válido y va con los avisos del DM", () => {
    expect(NOTIFICATION_TYPES).toContain("character_level_up");
    expect(emailPrefFor("character_level_up")).toBe("dm");
  });
  it("dice quién sube a qué personaje y enlaza a su ficha", () => {
    const r = describeNotification(
      { type: "character_level_up", text: "Grog a nivel 4", character: "abc123" },
      { username: "ana", displayName: "Ana" },
      { id: "c1", name: "Mesa" },
    );
    expect(r).toEqual({ text: "Ana ha subido a Grog a nivel 4", href: "/characters/abc123" });
  });
});

describe("avisos de personajes en la campaña", () => {
  const ana = { username: "ana", displayName: "Ana" };
  const mesa = { id: "c1", name: "Mesa" };
  const describe1 = (type: Parameters<typeof describeNotification>[0]["type"]) =>
    describeNotification({ type, text: "Grog", character: "abc123" }, ana, mesa);

  it("son tipos válidos con su preferencia de correo", () => {
    for (const t of ["character_approved", "character_rejected", "character_removed", "character_left"] as const)
      expect(NOTIFICATION_TYPES).toContain(t);
    expect(emailPrefFor("character_approved")).toBe("invites");
    expect(emailPrefFor("character_rejected")).toBe("removals");
    expect(emailPrefFor("character_removed")).toBe("removals");
    expect(emailPrefFor("character_left")).toBe("dm");
    expect(emailPrefFor("character_import_request")).toBe("dm");
  });
  it("textos y enlaces", () => {
    expect(describe1("character_import_request")).toEqual({
      text: "Ana solicita unir a Grog a Mesa", href: "/campaigns/c1/characters",
    });
    expect(describe1("character_approved")).toEqual({
      text: "Ana ha aceptado a Grog en Mesa", href: "/campaigns/c1/characters",
    });
    expect(describe1("character_rejected")).toEqual({ text: "Ana ha denegado a Grog en Mesa", href: "/characters/abc123" });
    expect(describe1("character_removed")).toEqual({ text: "Ana ha sacado a Grog de Mesa", href: "/characters/abc123" });
    expect(describe1("character_left")).toEqual({
      text: "Ana ha sacado a Grog de Mesa", href: "/campaigns/c1/characters",
    });
  });
});
