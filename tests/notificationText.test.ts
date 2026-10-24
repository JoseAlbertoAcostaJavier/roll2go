import { describe, expect, it } from "vitest";
import { describeNotification, emailPrefFor, NOTIFICATION_TYPES } from "@/lib/notificationText";

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
