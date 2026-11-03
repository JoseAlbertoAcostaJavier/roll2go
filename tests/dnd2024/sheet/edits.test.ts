import { describe, expect, it } from "vitest";
import { applyHp, applyInventoryOp } from "@/lib/rules/dnd2024/sheet/edits";
import type { Dnd2024SheetV2, InventoryItem } from "@/lib/rules/dnd2024/sheet/sheet";
import type { Ref } from "@/lib/rules/types";
import { buildCatalog, ref } from "../fixtureCatalog";

const catalog = buildCatalog();
const resolveItem = (r: Ref) => catalog.get(`${r.book}:${r.key}`) ?? null;
let n = 0;
const makeId = () => `new${++n}`;

const line = (id: string, key: string | null, equipped = false): InventoryItem => ({
  id, ref: key ? ref(key) : null, name: id, quantity: 1, equipped, notes: "",
});
const sheetWith = (items: InventoryItem[]) =>
  ({
    version: 2,
    hp: { max: null, current: 10, temp: 0 },
    inventory: { items, coins: { cp: 0, sp: 0, ep: 0, gp: 5, pp: 0 }, other: "" },
  }) as unknown as Dnd2024SheetV2;
// Catálogo con mochila (contenedor) y bolsa de contención (contenedor sin peso del contenido)
const withContainers = new Map(catalog);
{
  const base = catalog.get(`${ref("item:explorer's pack|xphb").book}:item:explorer's pack|xphb`)!;
  for (const [key, weightless] of [["item:bag|xphb", false], ["item:holding|xphb", true]] as const)
    withContainers.set(`${base.ref.book}:${key}`, {
      ...base, ref: ref(key), data: { weight: 5, container: { weight: 30, volume: null, items: [], weightless } },
    });
}
const opC = (sheet: Dnd2024SheetV2, o: unknown) =>
  applyInventoryOp(sheet, o, (x) => withContainers.get(`${x.book}:${x.key}`) ?? null, makeId);
const op = (sheet: Dnd2024SheetV2, o: unknown) => applyInventoryOp(sheet, o, resolveItem, makeId);

describe("applyHp", () => {
  const sheet = sheetWith([]);
  it("rechaza PG actuales por encima del máximo o negativos", () => {
    expect(applyHp(sheet, { current: 14, temp: 0 }, 13).ok).toBe(false);
    expect(applyHp(sheet, { current: -1, temp: 0 }, 13).ok).toBe(false);
    expect(applyHp(sheet, { current: 1.5 }, 13).ok).toBe(false);
  });
  it("acepta PG temporales y conserva lo que no llega", () => {
    const r = applyHp(sheet, { temp: 3 }, 13);
    expect(r.ok && r.sheet.hp).toEqual({ max: null, current: 10, temp: 3 });
    expect(applyHp(sheet, { temp: 10000 }, 13).ok).toBe(false);
    expect(applyHp(sheet, { current: 13, temp: 0 }, 13).ok).toBe(true);
  });
});

describe("applyInventoryOp", () => {
  it("añade un objeto del catálogo con su cantidad", () => {
    const r = op(sheetWith([]), { op: "add", ref: ref("item:greataxe|xphb"), quantity: 2 });
    expect(r.ok && r.sheet.inventory.items[0]).toMatchObject({ ref: ref("item:greataxe|xphb"), quantity: 2, equipped: false });
  });
  it("rechaza un objeto que el personaje no puede usar", () => {
    const r = op(sheetWith([]), { op: "add", ref: { book: "otro", key: "item:greataxe|xphb" }, quantity: 1 });
    expect(r).toEqual({ ok: false, error: "Ese objeto no está disponible para este personaje." });
  });
  it("añade un objeto personalizado sin ref", () => {
    const r = op(sheetWith([]), { op: "add", name: "Llave rara", quantity: 1, notes: "oxidada" });
    expect(r.ok && r.sheet.inventory.items[0]).toMatchObject({ ref: null, name: "Llave rara", notes: "oxidada" });
  });
  it("al equipar una segunda armadura desequipa la primera, pero no el escudo", () => {
    const s = sheetWith([
      line("a", "item:chain mail|xphb", true),
      line("b", "item:studded leather armor|xphb"),
      line("c", "item:shield|xphb", true),
    ]);
    const r = op(s, { op: "update", id: "b", equipped: true });
    expect(r.ok && r.sheet.inventory.items.map((i) => i.equipped)).toEqual([false, true, true]);
  });
  it("al equipar un segundo escudo desequipa el primero", () => {
    const s = sheetWith([line("a", "item:shield|xphb", true), line("b", "item:shield|xphb")]);
    const r = op(s, { op: "update", id: "b", equipped: true });
    expect(r.ok && r.sheet.inventory.items.map((i) => i.equipped)).toEqual([false, true]);
  });
  it("no equipa lo que no es arma, armadura ni escudo", () => {
    const s = sheetWith([line("p", "item:explorer's pack|xphb"), line("x", null)]);
    expect(op(s, { op: "update", id: "p", equipped: true }).ok).toBe(false);
    expect(op(s, { op: "update", id: "x", equipped: true }).ok).toBe(false);
  });
  it("equipa un objeto con defensas y no desequipa la armadura", () => {
    const withRing = new Map(catalog);
    const base = catalog.get(`${ref("item:explorer's pack|xphb").book}:item:explorer's pack|xphb`)!;
    withRing.set(`${base.ref.book}:item:ring|xphb`, { ...base, ref: ref("item:ring|xphb"), data: { defenses: { resist: ["poison"] } } });
    const s = sheetWith([line("a", "item:chain mail|xphb", true), line("r", "item:ring|xphb")]);
    const r = applyInventoryOp(s, { op: "update", id: "r", equipped: true }, (x) => withRing.get(`${x.book}:${x.key}`) ?? null, makeId);
    expect(r.ok && r.sheet.inventory.items.map((i) => i.equipped)).toEqual([true, true]);
  });
  it("el mensaje de rechazo menciona los objetos con defensas", () => {
    const r = op(sheetWith([line("p", "item:explorer's pack|xphb")]), { op: "update", id: "p", equipped: true });
    expect(!r.ok && r.error).toContain("resistencias o inmunidades");
  });
  it("valida cantidad, ids y monedas", () => {
    const s = sheetWith([line("a", "item:greataxe|xphb")]);
    expect(op(s, { op: "update", id: "a", quantity: 10000 }).ok).toBe(false);
    expect(op(s, { op: "update", id: "a", quantity: 9999 }).ok).toBe(true);
    expect(op(s, { op: "remove", id: "zzz" }).ok).toBe(false);
    expect(op(s, { op: "coins", coins: { cp: -1, sp: 0, ep: 0, gp: 0, pp: 0 } }).ok).toBe(false);
    const ok = op(s, { op: "coins", coins: { cp: 1, sp: 2, ep: 3, gp: 4, pp: 5 } });
    expect(ok.ok && ok.sheet.inventory.coins).toEqual({ cp: 1, sp: 2, ep: 3, gp: 4, pp: 5 });
  });
  it("quita una línea y limita las otras posesiones", () => {
    const s = sheetWith([line("a", null)]);
    const r = op(s, { op: "remove", id: "a" });
    expect(r.ok && r.sheet.inventory.items).toEqual([]);
    expect(op(s, { op: "other", text: "x".repeat(5001) }).ok).toBe(false);
    expect(op(s, { op: "other", text: "x".repeat(5000) }).ok).toBe(true);
  });
  it("limita las líneas a 300", () => {
    const items = Array.from({ length: 300 }, (_, i) => line(`l${i}`, null));
    expect(op(sheetWith(items), { op: "add", name: "Una más", quantity: 1 }).ok).toBe(false);
    expect(op(sheetWith(items.slice(1)), { op: "add", name: "Una más", quantity: 1 }).ok).toBe(true);
  });
  it("rechaza operaciones desconocidas y no muta la hoja", () => {
    const s = sheetWith([line("a", null)]);
    expect(op(s, { op: "nada" }).ok).toBe(false);
    expect(op(s, "x").ok).toBe(false);
    op(s, { op: "remove", id: "a" });
    expect(s.inventory.items).toHaveLength(1);
  });

  describe("contenedores", () => {
    const fixtureSheet = () => sheetWith([
      line("bag", "item:bag|xphb"), line("bag2", "item:holding|xphb"),
      line("sword", "item:greataxe|xphb", true), line("rope", null),
    ]);
    const items = (r: ReturnType<typeof op>) => (r.ok ? r.sheet.inventory.items : []);
    it("move a una mochila fija el contenedor y desequipa", () => {
      const r = opC(fixtureSheet(), { op: "move", id: "sword", container: "bag" });
      expect(items(r).find((i) => i.id === "sword")).toMatchObject({ container: "bag", equipped: false });
    });
    it("move con null deja la línea sin campo container", () => {
      const s = fixtureSheet();
      s.inventory.items[3].container = "bag";
      const r = opC(s, { op: "move", id: "rope", container: null });
      expect("container" in items(r)[3]).toBe(false);
    });
    it("move valida el destino y la petición", () => {
      const s = fixtureSheet();
      const err = (o: unknown) => { const r = opC(s, o); return !r.ok && r.error; };
      expect(err({ op: "move", id: "rope", container: "sword" })).toBe("Ese objeto no es un contenedor.");
      expect(err({ op: "move", id: "rope", container: "nada" })).toBe("Ese objeto no está en el inventario.");
      expect(err({ op: "move", id: "nada", container: "bag" })).toBe("Ese objeto no está en el inventario.");
      expect(err({ op: "move", id: "rope", container: 5 })).toBe("Petición no válida.");
      expect(err({ op: "move", id: "bag", container: "bag2" })).toBe("Un contenedor no puede ir dentro de otro.");
      expect(err({ op: "move", id: "bag", container: "bag" })).toBe("Un contenedor no puede ir dentro de otro.");
    });
    it("remove de un contenedor suelta su contenido", () => {
      const s = fixtureSheet();
      s.inventory.items[2].container = "bag";
      s.inventory.items[3].container = "bag";
      const r = opC(s, { op: "remove", id: "bag" });
      expect(items(r).map((i) => i.id)).toEqual(["bag2", "sword", "rope"]);
      expect(items(r).every((i) => !("container" in i))).toBe(true);
    });
    it("equipar una línea guardada la equipa y la saca del contenedor", () => {
      const s = fixtureSheet();
      s.inventory.items[2] = { ...s.inventory.items[2], equipped: false, container: "bag" };
      const r = opC(s, { op: "update", id: "sword", equipped: true });
      const sword = items(r).find((i) => i.id === "sword")!;
      expect(sword.equipped).toBe(true);
      expect("container" in sword).toBe(false);
    });
  });
});
