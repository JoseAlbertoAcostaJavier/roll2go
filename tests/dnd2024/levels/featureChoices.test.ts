import { describe, expect, it } from "vitest";
import { optionalFeatureAtLevel } from "@/lib/rules/dnd2024/levels/featureChoices";
import type { OptionalFeatureData } from "@/lib/rules/types";

describe("optionalFeatureAtLevel", () => {
  it("oculta lo que pide un nivel de clase mayor, aunque tenga otros requisitos", () => {
    expect(optionalFeatureAtLevel({ featureType: ["EI"], prerequisite: { level: 5 } } as OptionalFeatureData, 1)).toBe(false);
    expect(optionalFeatureAtLevel({ featureType: ["EI"], prerequisite: { level: 5, pact: "pact of the blade" } } as OptionalFeatureData, 1)).toBe(false);
  });
  it("deja los requisitos de pacto o de rasgo, y lo que no pide nivel", () => {
    expect(optionalFeatureAtLevel({ featureType: ["EI"], prerequisite: { pact: "pact of the tome" } } as OptionalFeatureData, 1)).toBe(true);
    expect(optionalFeatureAtLevel({ featureType: ["EI"] } as OptionalFeatureData, 1)).toBe(true);
    expect(optionalFeatureAtLevel({ featureType: ["EI"], prerequisite: { level: 5 } } as OptionalFeatureData, 5)).toBe(true);
  });
});
