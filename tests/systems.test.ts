import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSystemAvailable, system, systemHref } from "@/lib/utils/systems";

describe("disponibilidad de sistemas", () => {
  it("solo D&D 5.5 (2024) está disponible y enlaza al creador", () => {
    const available = system.filter(isSystemAvailable);
    expect(available.map((s) => s.id)).toEqual(["dnd-2024"]);
    expect(systemHref(available[0])).toBe("/characters/new?system=dnd-2024");
  });

  it("los demás no tienen enlace", () => {
    const rest = system.filter((s) => !isSystemAvailable(s));
    expect(rest).toHaveLength(5);
    expect(rest.every((s) => systemHref(s) === null)).toBe(true);
  });

  it("cada sistema tiene su ilustración y su logotipo o título", () => {
    for (const s of system) {
      expect(existsSync(`public${s.image}`), s.id).toBe(true);
      if (s.logo) expect(existsSync(`public${s.logo}`), s.id).toBe(true);
      else expect(s.title, s.id).toBeTruthy();
    }
  });
});
