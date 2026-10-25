import { describe, expect, test } from "vitest";
import { booksUsedBy } from "@/lib/rules/dnd2024/creation/booksUsed";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";

const r = (book: string, key: string) => ({ book, key });
const named = (book: string, key: string) => ({ ref: r(book, key), name: key });

const sheet = {
  version: 2,
  species: named("A", "species:elf"),
  lineage: null,
  background: { ...named("A", "background:sage"), abilities: {}, equipment: "A" },
  abilityMethod: "standard",
  baseAbilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  rolls: null,
  speciesChoices: { skills: [], size: null },
  alignment: "", appearance: "", age: "", languages: "", notes: "", xp: 0,
  hp: { max: null, current: null, temp: 0 },
  levels: [
    { n: 1, class: named("A", "class:wizard"), classLevel: 1, hp: { method: "max", value: 6 }, choices: [] },
    {
      n: 2, class: named("A", "class:wizard"), classLevel: 2, hp: { method: "average", value: 4 },
      choices: [{ type: "feat", source: "x", value: [{ ...named("B", "feat:alert"), ability: "dex" }] }],
    },
  ],
  classesSummary: [],
  inventory: {
    items: [
      { id: "i1", ref: r("C", "item:dagger"), name: "Daga", quantity: 1, equipped: false, notes: "" },
      { id: "i2", ref: null, name: "Cuerda", quantity: 1, equipped: false, notes: "" },
    ],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    other: "",
  },
  prepared: { "class:wizard": [r("D", "spell:shield")] },
  spellbookExtra: [],
  slotsUsed: {},
  weaponMasteries: [],
} as Dnd2024SheetV2;

describe("booksUsedBy", () => {
  test("recoge los libros de especie, elecciones, inventario y conjuros, sin duplicados", () => {
    expect(booksUsedBy(sheet).sort()).toEqual(["A", "B", "C", "D"]);
  });

  test("también legado, subclase, libro de conjuros y maestrías", () => {
    const more = {
      ...sheet,
      lineage: named("E", "lineage:x"),
      levels: [{ ...sheet.levels[0], choices: [{ type: "subclass", source: "s", value: named("F", "subclass:y") }] }],
      spellbookExtra: [named("G", "spell:z")],
      weaponMasteries: [r("H", "item:longsword")],
    } as Dnd2024SheetV2;
    expect(booksUsedBy(more).sort()).toEqual(["A", "C", "D", "E", "F", "G", "H"]);
  });
});
