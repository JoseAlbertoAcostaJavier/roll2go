import { describe, expect, it } from "vitest";
import { blockGrants } from "@/lib/rules/import/normalize";

describe("blockGrants: usos por competencia", () => {
  it("el conjuro de `daily.pb` lleva uses pb; el truco conocido, no", () => {
    const grants = blockGrants([{
      innate: { "3": { daily: { pb: ["speak with animals|xphb"] } } },
      ability: { choose: ["int", "wis", "cha"] },
      known: { "1": ["minor illusion|xphb#c"] },
    }]);
    expect(grants).toHaveLength(2);
    const innate = grants.find((g) => g.level === 3)!;
    expect(innate.ref.key).toContain("speak with animals");
    expect(innate.uses).toBe("pb");
    const cantrip = grants.find((g) => g.level === 1)!;
    expect(cantrip).not.toHaveProperty("uses");
  });
  it("`daily` por nivel de conjuro no lleva uses", () => {
    const grants = blockGrants([{ innate: { "3": { daily: { "1": ["misty step|xphb"] } } } }]);
    expect(grants).toHaveLength(1);
    expect(grants[0]).not.toHaveProperty("uses");
  });
});
