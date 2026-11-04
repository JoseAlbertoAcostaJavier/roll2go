import { describe, expect, it } from "vitest";
import { choosePacks, languageTotal, pruneLanguages, prunePicks } from "@/lib/rules/dnd2024/creation/creatorPicks";
import { fixedLanguages, languageSlots } from "@/lib/rules/dnd2024/creation/languages";
import type { Equipment } from "@/lib/rules/types";
import { ref } from "../fixtureCatalog";

const equipment: Equipment = {
  A: [{ ref: ref("item:dagger|xphb") }, { displayName: "Un juego (a elegir)", choose: { kinds: ["gaming"], label: "Un juego (a elegir)" } }],
  B: [{ value: 5000 }],
};

describe("choosePacks / prunePicks", () => {
  it("lista los paquetes con `choose` de la opción, con su índice en texto", () => {
    expect(choosePacks(equipment, "A").map((c) => c.index)).toEqual(["1"]);
    expect(choosePacks(equipment, "B")).toEqual([]);
    expect(choosePacks(undefined, "A")).toEqual([]);
  });
  it("al cambiar de opción se quitan los picks que ya no valen", () => {
    const picks = { "1": ref("item:dice set|xphb"), "0": ref("item:dagger|xphb"), "7": ref("item:x|xphb") };
    expect(prunePicks(picks, equipment, "A")).toEqual({ "1": ref("item:dice set|xphb") });
    expect(prunePicks(picks, equipment, "B")).toEqual({});
  });
});

describe("pruneLanguages", () => {
  const types: Record<string, string> = {
    "language:elvish|xphb": "standard", "language:dwarvish|xphb": "standard", "language:celestial|xphb": "rare",
    "language:druidic|xphb": "rare",
  };
  const typeOf = (r: { key: string }) => types[r.key] ?? null;
  const l = (name: string) => ref(`language:${name}|xphb`);

  it("deja los huecos de la clase: origen y Jerga de ladrones", () => {
    const levels = { rogue: 1 };
    expect(languageTotal(languageSlots(levels))).toBe(3);
    expect(pruneLanguages([l("elvish"), l("dwarvish"), l("celestial")], languageSlots(levels), fixedLanguages(levels), typeOf))
      .toEqual([l("elvish"), l("dwarvish"), l("celestial")]);
  });
  it("al quitar la clase se pierden los huecos de más", () => {
    const levels = { wizard: 1 };
    expect(pruneLanguages([l("elvish"), l("dwarvish"), l("celestial")], languageSlots(levels), fixedLanguages(levels), typeOf))
      .toEqual([l("elvish"), l("dwarvish")]);
  });
  it("quita lo que la clase ya da, lo no estándar en origen y lo repetido", () => {
    const levels = { druid: 1 };
    expect(pruneLanguages([l("druidic"), l("elvish")], languageSlots(levels), fixedLanguages(levels), typeOf))
      .toEqual([null, l("elvish")]);
    expect(pruneLanguages([l("celestial"), l("elvish")], languageSlots({}), [], typeOf)).toEqual([null, l("elvish")]);
    expect(pruneLanguages([l("elvish"), l("elvish")], languageSlots({}), [], typeOf)).toEqual([l("elvish"), null]);
  });
  it("compara por nombre: el mismo idioma de otro libro es el mismo", () => {
    const other = (name: string) => ({ book: "otro", key: `language:${name}|otro` });
    const t = () => "standard";
    expect(pruneLanguages([l("elvish"), other("elvish")], languageSlots({}), [], t)).toEqual([l("elvish"), null]);
    expect(pruneLanguages([other("common"), l("elvish")], languageSlots({}), fixedLanguages({}), t)).toEqual([null, l("elvish")]);
  });
  it("rellena con null los huecos sin elegir", () => {
    expect(pruneLanguages([], languageSlots({ rogue: 1 }), [], typeOf)).toEqual([null, null, null]);
  });
});
