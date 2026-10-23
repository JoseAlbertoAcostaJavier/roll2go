import { describe, expect, test } from "vitest";
import { planImport } from "@/lib/rules/import/plan";
import { matchFoundry } from "@/lib/rules/import/foundry";
import type { NormalizedEntry } from "@/lib/rules/import/normalize";

const mk = (key: string, srd52: boolean, kind = "feat"): NormalizedEntry =>
  ({ kind, key, identifier: "", parent: null, name: key, description: "", srd52, data: {} }) as unknown as NormalizedEntry;

describe("planImport", () => {
  const incoming = [mk("feat:a|xphb", true), mk("feat:b|xphb", false)];

  test("sin --srd-only importa todo", () => {
    const plan = planImport([], incoming, { srdOnly: false });
    expect(plan.upserts.map((e) => e.key)).toEqual(["feat:a|xphb", "feat:b|xphb"]);
    expect(plan.deletes).toEqual([]);
  });

  test("con --srd-only descarta lo que no es SRD y borra lo que ya existía", () => {
    const plan = planImport(["feat:b|xphb"], incoming, { srdOnly: true });
    expect(plan.upserts.map((e) => e.key)).toEqual(["feat:a|xphb"]);
    expect(plan.deletes).toEqual(["feat:b|xphb"]);
  });

  test("las claves existentes que ya no llegan se borran", () => {
    const plan = planImport(["feat:a|xphb", "feat:viejo|xphb"], incoming, { srdOnly: false });
    expect(plan.deletes).toEqual(["feat:viejo|xphb"]);
  });

  test("reimportar lo mismo no borra nada", () => {
    const plan = planImport(incoming.map((e) => e.key), incoming, { srdOnly: false });
    expect(plan.deletes).toEqual([]);
  });
});

describe("matchFoundry", () => {
  test("empareja por nombre|fuente sin distinguir mayúsculas y quita name/source", () => {
    const entries = [mk("feat:alert|xphb", true), mk("spell:alert|xphb", true, "spell")];
    const m = matchFoundry(entries, {
      feats: { feat: [{ name: "Alert", source: "XPHB", activities: { x: 1 } }] },
    });
    expect(m.get("feat:alert|xphb")).toEqual({ activities: { x: 1 } });
    expect(m.has("spell:alert|xphb")).toBe(false);
  });

  test("rasgos de clase se emparejan con clase y nivel", () => {
    const entries = [mk("classFeature:rage|barbarian|phb|1", true, "classFeature")];
    const m = matchFoundry(entries, {
      classes: { classFeature: [
        { name: "Rage", source: "PHB", className: "Barbarian", classSource: "PHB", level: 2, a: 0 },
        { name: "Rage", source: "PHB", className: "Barbarian", classSource: "PHB", level: 1, a: 1 },
      ] },
    });
    expect(m.get("classFeature:rage|barbarian|phb|1")).toMatchObject({ a: 1 });
  });
});
