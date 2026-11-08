import { describe, expect, it, vi } from "vitest";

const catalog = vi.hoisted(() => ({
  listEntries: vi.fn(async ({ kind }: { kind: string }) => (kind === "species"
    ? [
      { ref: { book: "a", key: "species:elf|a" }, data: { hasLineages: true } },
      { ref: { book: "b", key: "species:genasi|b" }, data: { hasLineages: true } },
      { ref: { book: "b", key: "species:orc|b" }, data: { hasLineages: false } },
    ]
    : kind === "class"
      ? [
        { ref: { book: "a", key: "class:apothecary|a" }, data: { subclassLevel: 1 } },
        { ref: { book: "a", key: "class:fighter|a" }, data: { subclassLevel: 3 } },
      ]
      : [])),
}));

vi.mock("@/lib/server/catalog/catalog", () => ({
  NotFoundError: class extends Error {},
  listEntries: catalog.listEntries,
  listChoiceItems: vi.fn(async () => []),
  listMasteryWeapons: vi.fn(async () => []),
  usableBooks: vi.fn(async () => []),
}));

import { loadCreatorLists } from "@/lib/server/characters/queries";

describe("loadCreatorLists", () => {
  it("carga las subclases solo de las clases que la eligen en el nivel 1", async () => {
    catalog.listEntries.mockClear();
    const lists = await loadCreatorLists(["a", "b"]);
    const asked = catalog.listEntries.mock.calls.map(([o]) => o as { kind: string; parent?: string }).filter((o) => o.kind === "subclass");
    expect(asked.map((o) => o.parent)).toEqual(["class:apothecary|a"]);
    expect(Object.keys(lists.levelOneSubclasses)).toEqual(["a:class:apothecary|a"]);
  });

  it("busca los legados de cada especie solo en su libro, no en todos", async () => {
    catalog.listEntries.mockClear();
    await loadCreatorLists(["a", "b", "c"]);
    const lineages = catalog.listEntries.mock.calls.map(([o]) => o as { kind: string; books: string[]; parent?: string }).filter((o) => o.kind === "lineage");
    expect(lineages.map((o) => [o.parent, o.books])).toEqual([["species:elf|a", ["a"]], ["species:genasi|b", ["b"]]]);
  });
});
