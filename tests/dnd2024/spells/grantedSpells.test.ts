import { describe, expect, it } from "vitest";
import { crossSourceGranted } from "@/lib/rules/dnd2024/spells/grantedSpells";

describe("crossSourceGranted", () => {
  const picks = [
    { source: "class", label: "la clase", keys: ["spell:shocking grasp|xphb"] },
    { source: "featSpells:magic initiate", label: "Iniciado en la magia", keys: ["spell:light|xphb"] },
  ];

  it("cada fuente ve las demás, no la suya", () => {
    expect(crossSourceGranted(["spell:dancing lights|xphb"], picks, "class")).toEqual([
      { key: "spell:dancing lights|xphb", label: null },
      { key: "spell:light|xphb", label: "Iniciado en la magia" },
    ]);
    expect(crossSourceGranted([], picks, "featSpells:magic initiate")).toEqual([
      { key: "spell:shocking grasp|xphb", label: "la clase" },
    ]);
  });

  it("una clave repetida conserva la primera", () => {
    const dup = [{ source: "a", label: "A", keys: ["x"] }, { source: "b", label: "B", keys: ["x"] }];
    expect(crossSourceGranted(["x"], dup, "c")).toEqual([{ key: "x", label: null }]);
    expect(crossSourceGranted([], dup, "c")).toEqual([{ key: "x", label: "A" }]);
  });
});
