import { beforeEach, describe, expect, it, vi } from "vitest";

const A = "a00000000000000000000001";
const B = "b00000000000000000000002";

const db = await vi.hoisted(async () => (await import("./fakeDb")).createFakeDb());
const cache = vi.hoisted(() => ({ options: [] as { tags?: string[] }[], keys: [] as string[][] }));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown, key: string[], options: { tags?: string[] }) => {
    cache.keys.push(key);
    cache.options.push(options);
    return fn;
  },
  revalidateTag: () => {},
}));
vi.mock("@/lib/models/mongodb", () => ({ connectDB: async () => {} }));
for (const name of ["Book", "BookEntry", "Campaign"]) {
  vi.doMock(`@/lib/models/${name}`, () => ({ [name]: db.model(name) }));
}

const catalog = await import("@/lib/server/catalog/catalog");

const entry = (book: string, key: string, data: unknown, nameLower = key) => ({ book, key, name: key, nameLower, data });
const language = { type: "standard" };

beforeEach(() => {
  db.reset();
  cache.options.length = 0;
  cache.keys.length = 0;
  db.results["Book.find"] = [{ _id: A, name: "Libro A" }, { _id: B, name: "Libro B" }];
});

describe("listEntries", () => {
  it("hace una sola consulta aunque haya varios libros", async () => {
    db.results["BookEntry.find"] = [];
    await catalog.listEntries({ books: [A, B], kind: "language" });
    expect(db.callsOf("BookEntry", "find")).toHaveLength(1);
    expect(db.callsOf("Book", "find")).toHaveLength(1);
  });

  it("no ofrece lo sustituido por una versión más nueva", async () => {
    db.results["BookEntry.find"] = [];
    await catalog.listEntries({ books: [A], kind: "language" });
    expect(db.callsOf("BookEntry", "find")[0][0]).toMatchObject({ kind: "language", superseded: { $ne: true } });
  });

  it("devuelve cada entrada con el nombre de su libro y sus datos, en el orden de la consulta", async () => {
    db.results["BookEntry.find"] = [entry(B, "language:abisal|b", language), entry(A, "language:comun|a", language)];
    const out = await catalog.listEntries({ books: [A, B], kind: "language" });
    expect(out.map((o) => [o.ref.key, o.bookName, o.data])).toEqual([
      ["language:abisal|b", "Libro B", language],
      ["language:comun|a", "Libro A", language],
    ]);
  });

  it("omite las entradas con datos no válidos y las de libros que ya no existen", async () => {
    db.results["BookEntry.find"] = [
      entry(A, "language:mala|a", { type: "otro" }),
      entry("c00000000000000000000003", "language:huerfana|c", language),
      entry(A, "language:buena|a", language),
    ];
    const out = await catalog.listEntries({ books: [A], kind: "language" });
    expect(out.map((o) => o.ref.key)).toEqual(["language:buena|a"]);
  });

  it("sin libros válidos no consulta nada", async () => {
    expect(await catalog.listEntries({ books: ["no-es-un-id"], kind: "language" })).toEqual([]);
    expect(db.callsOf("BookEntry", "find")).toHaveLength(0);
  });

  it("la caché depende de los libros y de los filtros, y se invalida con cualquiera de sus libros", async () => {
    db.results["BookEntry.find"] = [];
    await catalog.listEntries({ books: [B, A, A], kind: "lineage", parent: "species:elf|a", q: "Dró" });
    expect(cache.keys[0]).toEqual(["rules-entries-v9", `${A},${B}`, "lineage", "species:elf|a", "dro"]);
    expect(cache.options[0].tags).toEqual([`book:${A}`, `book:${B}`]);
    expect(db.callsOf("BookEntry", "find")[0][0]).toMatchObject({ book: { $in: [A, B] }, "parent.key": "species:elf|a", nameLower: { $regex: "^dro" } });
  });
});

describe("listas especializadas", () => {
  beforeEach(() => {
    db.results["BookEntry.find"] = [];
  });

  it.each([
    ["armas con maestría", () => catalog.listMasteryWeapons([A, B]), "item"],
    ["objetos a elegir", () => catalog.listChoiceItems([A, B]), "item"],
    ["conjuros", () => catalog.listSpells([A, B]), "spell"],
    ["acciones", () => catalog.listActions([A, B]), "action"],
  ])("%s: una consulta y sin lo sustituido", async (_name, list, kind) => {
    await list();
    const calls = db.callsOf("BookEntry", "find");
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toMatchObject({ book: { $in: [A, B] }, kind, superseded: { $ne: true } });
  });
});
