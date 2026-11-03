import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/lib/rules/dnd2024/sheet/sheet";
import { effectiveContainer, inventoryWeights, startingInventory, type WeightInfo } from "@/lib/rules/dnd2024/sheet/inventory";
import type { BackgroundData, ClassData } from "@/lib/rules/types";
import { B, buildCatalog, ref } from "../fixtureCatalog";

const counter = () => {
  let i = 0;
  return () => `id${++i}`;
};
const catalog = buildCatalog();
const classData = catalog.get(`${B}:class:barbarian|xphb`)!.data as ClassData;
const bgData = catalog.get(`${B}:background:acolyte|xphb`)!.data as BackgroundData;

describe("startingInventory", () => {
  it("Bárbaro A + Acólito A: paquete desplegado, monedas y armas equipadas", () => {
    const inv = startingInventory([{ pack: classData.equipment.A }, { pack: bgData.equipment.A }], catalog, counter());
    expect(inv.coins).toEqual({ cp: 0, sp: 0, ep: 0, gp: 23, pp: 0 });
    expect(inv.other).toBe("");
    const byKey = (key: string) => inv.items.find((i) => i.ref?.key === key);
    expect(byKey("item:greataxe|xphb")).toMatchObject({ name: "Greataxe", quantity: 1, equipped: true });
    expect(byKey("item:handaxe|xphb")).toMatchObject({ quantity: 4, equipped: true });
    expect(byKey("item:backpack|xphb")).toMatchObject({ name: "backpack", equipped: false });
    expect(byKey("item:explorer's pack|xphb")).toBeUndefined();
    expect(byKey("item:torch|xphb")?.quantity).toBe(10);
    // Objeto que no está en el catálogo: se queda con el nombre del paquete
    expect(byKey("item:book|xphb")?.name).toBe("Book (Prayers)");
    expect(new Set(inv.items.map((i) => i.id)).size).toBe(inv.items.length);
    expect(inv.items.every((i) => i.notes === "")).toBe(true);
  });

  it("Guerrero opción C: solo monedas", () => {
    const inv = startingInventory([{ pack: [{ value: 15500 }] }, { pack: [] }], catalog, counter());
    expect(inv.items).toEqual([]);
    expect(inv.coins.gp).toBe(155);
  });

  it("reparte lo que no son piezas de oro en plata y cobre", () => {
    const inv = startingInventory([{ pack: [{ value: 1234 }] }], catalog, counter());
    expect(inv.coins).toEqual({ cp: 4, sp: 3, ep: 0, gp: 12, pp: 0 });
  });

  it("suma las líneas del mismo objeto", () => {
    const packs = [
      { ref: ref("item:explorer's pack|xphb"), quantity: 2 },
      { ref: ref("item:torch|xphb"), quantity: 3 },
    ];
    const inv = startingInventory([{ pack: packs }], catalog, counter());
    expect(inv.items.filter((i) => i.ref?.key === "item:torch|xphb")).toHaveLength(1);
    expect(inv.items.find((i) => i.ref?.key === "item:torch|xphb")?.quantity).toBe(23);
  });

  it("equipa la armadura de mayor CA y solo el primer escudo", () => {
    const packs = [
      { ref: ref("item:studded leather armor|xphb") },
      { ref: ref("item:chain mail|xphb") },
      { ref: ref("item:shield|xphb"), quantity: 2 },
    ];
    const inv = startingInventory([{ pack: packs }], catalog, counter());
    const byKey = (key: string) => inv.items.find((i) => i.ref?.key === key);
    expect(byKey("item:chain mail|xphb")?.equipped).toBe(true);
    expect(byKey("item:studded leather armor|xphb")?.equipped).toBe(false);
    expect(byKey("item:shield|xphb")?.equipped).toBe(true);
  });

  it("los textos sin referencia son líneas personalizadas", () => {
    const inv = startingInventory([{ pack: [{ displayName: "Carta de un amigo" }] }], catalog, counter());
    expect(inv.items).toEqual([
      { id: "id1", ref: null, name: "Carta de un amigo", quantity: 1, equipped: false, notes: "" },
    ]);
  });
});

describe("inventoryWeights", () => {
  const l = (id: string, quantity = 1, container?: string): InventoryItem =>
    ({ id, ref: null, name: id, quantity, equipped: false, notes: "", ...(container ? { container } : {}) });
  const info: Record<string, WeightInfo> = {
    mochila: { weight: 5, container: { weightless: false } },
    bolsa: { weight: 15, container: { weightless: true } },
    raciones: { weight: 2, container: null },
    cuerda: { weight: 5, container: null },
    piedra: { weight: 10, container: null },
  };
  it("mochila con raciones dentro y cuerda suelta", () => {
    const items = [l("mochila"), l("raciones", 2, "mochila"), l("cuerda")];
    expect(inventoryWeights(items, info)).toEqual({ carried: 14, byContainer: { mochila: 4 } });
  });
  it("bolsa sin peso: cuenta la bolsa pero no su contenido", () => {
    expect(inventoryWeights([l("bolsa"), l("piedra", 1, "bolsa")], info)).toEqual({ carried: 15, byContainer: { bolsa: 10 } });
  });
  it("contenedor vacío aparece con 0", () => {
    expect(inventoryWeights([l("mochila")], info).byContainer).toEqual({ mochila: 0 });
  });
  it("contenedor inexistente o que no es contenedor: suelta", () => {
    const items = [l("cuerda", 1, "fantasma"), l("raciones", 1, "piedra"), l("piedra")];
    expect(inventoryWeights(items, info)).toEqual({ carried: 17, byContainer: {} });
    expect(effectiveContainer(items[0], items, info)).toBeNull();
    expect(effectiveContainer(items[1], items, info)).toBeNull();
  });
  it("sin contenedores es la suma simple", () => {
    expect(inventoryWeights([l("raciones", 3), l("cuerda")], info)).toEqual({ carried: 11, byContainer: {} });
  });
});
