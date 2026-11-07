import { describe, expect, it } from "vitest";
import { applyInventoryOp, MAX_ATTUNED } from "@/lib/rules/dnd2024/sheet/edits";
import { applyRest, type RestCtx } from "@/lib/rules/dnd2024/sheet/rest";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import { applySpellOp, type SpellOpCtx } from "@/lib/rules/dnd2024/spells/spellOps";
import { preparedKey } from "@/lib/rules/dnd2024/spells/spellcasting";
import { spellTableRows } from "@/lib/rules/dnd2024/spells/spellTable";
import type { CasterBlock, SpellsSummary } from "@/lib/rules/dnd2024/derive/spells";
import type { CatalogEntry } from "@/lib/rules/catalog/types";

const restCtx: RestCtx = { pools: [], conMod: 0, maxHp: 10, featureUses: [], roll: () => 1 };
const withHp = { hp: { max: null, current: 5, temp: 7 }, slotsUsed: {} } as unknown as Dnd2024SheetV2;
const hpAfter = (op: object) => {
  const r = applyRest(withHp, op, restCtx);
  if (!r.ok) throw new Error(r.error);
  return r.sheet.hp;
};

describe("opciones de los descansos", () => {
  it("el largo quita los temporales salvo que se pida conservarlos", () => {
    expect(hpAfter({ op: "longRest" }).temp).toBe(0);
    expect(hpAfter({ op: "longRest", keepTemp: true }).temp).toBe(7);
  });

  it("el corto los conserva salvo que se pida quitarlos", () => {
    expect(hpAfter({ op: "shortRest" }).temp).toBe(7);
    expect(hpAfter({ op: "shortRest", clearTemp: true })).toMatchObject({ temp: 0, current: 5 });
  });
});

describe("sintonización", () => {
  const line = (id: string, attuned = false) => ({ id, ref: null, name: id, quantity: 1, equipped: false, notes: "", attuned });
  const sheet = (lines: ReturnType<typeof line>[]) =>
    ({ inventory: { items: lines, coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, other: "" } }) as unknown as Dnd2024SheetV2;
  const op = (s: Dnd2024SheetV2, id: string, attuned: unknown) => applyInventoryOp(s, { op: "update", id, attuned }, () => null, () => "x");

  it("marca y desmarca", () => {
    const r = op(sheet([line("a")]), "a", true);
    if (!r.ok) throw new Error(r.error);
    expect(r.sheet.inventory.items[0].attuned).toBe(true);
  });

  it("no deja pasar del máximo, pero sí quitar uno con el máximo lleno", () => {
    const full = sheet([...Array.from({ length: MAX_ATTUNED }, (_, i) => line(`a${i}`, true)), line("b")]);
    expect(op(full, "b", true).ok).toBe(false);
    expect(op(full, "a0", false).ok).toBe(true);
  });

  it("rechaza lo que no es un booleano", () => {
    expect(op(sheet([line("a")]), "a", "sí").ok).toBe(false);
  });
});

const CLS = { book: "b", key: "class:wizard|xphb" };
const spellRef = (n: string) => ({ book: "b", key: `spell:${n}|xphb` });
const spellEntry = (n: string, level: number, classes = ["wizard"]) => ({
  ref: spellRef(n), name: n, nameEs: null, bookName: "", srd52: false, description: "", descriptionEs: "", identifier: "", page: null, parent: null, foundry: null,
  data: { level, school: "V", time: "1 acción", range: "", duration: "", components: "", concentration: false, ritual: false, classes, tags: [] },
}) as unknown as CatalogEntry;
const block = (over: Partial<CasterBlock> = {}) => ({
  class: CLS, name: "Mago", mode: "list", attack: 5, dc: 13, maxSpellLevel: 1, preparedLimit: 2, cantrips: [], known: [], spellbook: [],
  prepared: [], always: [], limited: [], ...over,
}) as unknown as CasterBlock;
const summary = (b: CasterBlock) => ({ blocks: [b], other: [], limitedUsed: {} }) as unknown as SpellsSummary;
const entriesOf = (...list: CatalogEntry[]) => new Map(list.map((e) => [`${e.ref.book}:${e.ref.key}`, e]));

describe("desmarcar todos los preparados", () => {
  const ctx = (b: CasterBlock) => ({ blocks: [b], slots: { levels: {}, pact: null }, other: [], resolve: () => null }) as unknown as SpellOpCtx;
  const sheet = { prepared: { [preparedKey(CLS)]: [spellRef("a")], otro: [spellRef("z")] } } as unknown as Dnd2024SheetV2;

  it("vacía los de esa clase y no toca los de otra", () => {
    const r = applySpellOp(sheet, { op: "unprepareAll", class: CLS }, ctx(block()));
    if (!r.ok) throw new Error(r.error);
    expect(Object.values(r.sheet.prepared).flat()).toEqual([spellRef("z")]);
  });

  it("no aplica a quien aprende conjuros al subir de nivel", () => {
    expect(applySpellOp(sheet, { op: "unprepareAll", class: CLS }, ctx(block({ mode: "levelUp" }))).ok).toBe(false);
  });
});

describe("filas de los conjuros que se pueden preparar", () => {
  const entries = entriesOf(spellEntry("a", 1), spellEntry("b", 1), spellEntry("alto", 3), spellEntry("truco", 0), spellEntry("ajeno", 1, ["cleric"]));
  const keys = (rows: ReturnType<typeof spellTableRows>) => rows.map((r) => r.nameEn);
  const listsOf = () => ["wizard"];

  it("sin listas, solo los utilizables, como antes", () => {
    expect(keys(spellTableRows(summary(block({ prepared: [spellRef("a")] })), entries))).toEqual(["a"]);
  });

  it("con listas, también los de su lista hasta su nivel máximo, sin trucos ni los de otras clases", () => {
    const rows = spellTableRows(summary(block({ prepared: [spellRef("a")] })), entries, { listsOf });
    expect(keys(rows).sort()).toEqual(["a", "b"]);
    expect(rows.every((r) => r.prepare?.key === CLS.key)).toBe(true);
  });

  it("el Mago solo puede preparar los de su libro", () => {
    const b = block({ mode: "spellbook", spellbook: [{ ref: spellRef("b"), name: "b" }] });
    expect(keys(spellTableRows(summary(b), entries, { listsOf }))).toEqual(["b"]);
  });

  it("quien aprende al subir de nivel no tiene interruptor ni candidatos", () => {
    const b = block({ mode: "levelUp", known: [{ ref: spellRef("a"), name: "a" }] });
    expect(spellTableRows(summary(b), entries, { listsOf }).every((r) => r.prepare === null)).toBe(true);
  });

  it("el daño va en su columna con sus dados; sin daño, nada", () => {
    const hurt = { ...spellEntry("fuego", 1), data: { ...(spellEntry("fuego", 1).data as object), damage: { dice: "3d6" }, tags: ["Daño de fuego"] } } as unknown as CatalogEntry;
    const rows = spellTableRows(summary(block({ prepared: [spellRef("fuego"), spellRef("a")] })), entriesOf(hurt, spellEntry("a", 1)));
    expect(rows.find((r) => r.nameEn === "fuego")?.damage).toEqual({ dice: "3d6", damageTypeId: "fire", healing: false });
    expect(rows.find((r) => r.nameEn === "a")?.damage).toBeNull();
  });
});
