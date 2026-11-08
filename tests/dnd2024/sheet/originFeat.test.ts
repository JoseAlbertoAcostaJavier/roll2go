import { describe, expect, it } from "vitest";
import { characterFeats } from "@/lib/rules/dnd2024/derive/features";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import { withHomebrew, type Homebrew } from "@/lib/rules/import/homebrew";
import { normalizeAll, type RawFiles } from "@/lib/rules/import/normalize";
import { speciesLabel } from "@/lib/rules/dnd2024/sheet/labels";
import type { BackgroundData } from "@/lib/rules/types";

const CHOSEN = { book: "b", key: "feat:alert|xphb" };
const OWN = { book: "b", key: "feat:magic initiate|xphb" };
const sheet = (feat?: typeof CHOSEN) => ({
  background: { ref: { book: "b", key: "background:guild|phb" }, name: "x", abilities: {}, equipment: "A", ...(feat ? { feat } : {}) },
  levels: [],
}) as unknown as Dnd2024SheetV2;
const background = (feat: typeof CHOSEN | null) => ({ feat }) as BackgroundData;

describe("dote de origen en la ficha", () => {
  it("la elegida cuenta si el trasfondo no trae la suya", () => {
    expect(characterFeats(sheet(CHOSEN), background(null)).map((f) => f.ref)).toEqual([CHOSEN]);
  });

  it("manda la del trasfondo si la tiene", () => {
    expect(characterFeats(sheet(CHOSEN), background(OWN)).map((f) => f.ref)).toEqual([OWN]);
  });

  it("sin ninguna, no hay dote", () => {
    expect(characterFeats(sheet(), background(null))).toEqual([]);
  });

});

describe("speciesLabel", () => {
  it("no repite la especie si el legado ya la nombra", () => {
    expect(speciesLabel("Genasi", "Genasi (Fuego)")).toBe("Genasi (Fuego)");
    expect(speciesLabel("Elfo", "Drow")).toBe("Elfo (Drow)");
    expect(speciesLabel("Humano", null)).toBe("Humano");
  });
});

describe("archivos de homebrew", () => {
  const base: RawFiles = { races: { race: [{ name: "Oficial", source: "PHB" }], subrace: [] }, classes: [] };
  const brew: Homebrew = {
    race: [{ name: "Propia", source: "BREW", size: ["M"], speed: 30, entries: [] }],
    condition: [{ name: "Maldito", source: "BREW", entries: ["x"] }],
    class: [{ name: "Cazador", source: "BREW" }],
    classFeature: [{ name: "Weapon Mastery", className: "Cazador", level: 1, entries: ["two kinds"] }],
    spell: [{ name: "Hechizo", source: "BREW" }],
  };
  const merged = withHomebrew(base, brew);

  it("conserva lo oficial y añade lo del archivo", () => {
    expect(merged.races?.race).toHaveLength(2);
    expect(merged.conditions?.condition).toHaveLength(1);
    expect(merged.spells?.at(-1)?.spell).toHaveLength(1);
  });

  it("deduce las maestrías de sus clases", () => {
    expect((merged.classes?.[0].class?.[0] as Record<string, unknown>).itemMasteriesProgression).toEqual({ 1: 2 });
  });

  it("sus entradas se normalizan con su fuente", () => {
    const { entries } = normalizeAll(merged, "BREW");
    expect(entries.map((e) => e.key)).toEqual(expect.arrayContaining(["species:propia|brew", "condition:maldito|brew"]));
    expect(entries.some((e) => e.key === "species:oficial|phb")).toBe(false);
  });
});
