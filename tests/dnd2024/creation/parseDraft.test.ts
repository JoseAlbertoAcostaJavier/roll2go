import { describe, expect, it } from "vitest";
import { parseDraft } from "@/app/components/characters/creator/CharacterCreator";

const props = { species: [], lineages: {}, classes: [], backgrounds: [] } as unknown as Parameters<typeof parseDraft>[1];

describe("parseDraft", () => {
  it("un borrador antiguo con `prepared` se lee sin fallar y el formulario ya no lo tiene", () => {
    const raw = JSON.stringify({
      name: "Ana", prepared: ["xphb:spell:bless|xphb"],
      method: "roll", rolls: { values: [15, 14, 13, 12, 10, 8], token: "1.abc" },
    });
    const form = parseDraft(raw, props);
    expect(form.name).toBe("Ana");
    expect(form.method).toBe("roll");
    expect(form.rolls).toMatchObject({ values: [15, 14, 13, 12, 10, 8], token: "1.abc" });
    expect(form).not.toHaveProperty("prepared");
  });
});
