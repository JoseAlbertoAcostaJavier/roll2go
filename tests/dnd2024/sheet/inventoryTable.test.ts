import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/lib/rules/dnd2024/sheet/sheet";
import {
  inventoryChips, inventoryGroups, inventoryHref, matchesItem, searchText, type ItemInfo,
} from "@/lib/rules/dnd2024/sheet/inventoryTable";
import { parseSection } from "@/lib/rules/dnd2024/sheet/sheetSections";

const line = (id: string, name: string, extra: Partial<InventoryItem> = {}): InventoryItem => ({
  id, ref: null, name, quantity: 1, equipped: false, notes: "", ...extra,
});
const base: ItemInfo = {
  weight: 0, equippable: false, nameEn: null, type: null, rarity: null, properties: [], value: 0, container: null,
};

const items = [
  line("dagger", "Daga"),
  line("potion", "Poción de curación"),
  line("pack", "Mochila"),
  line("rations", "Raciones", { quantity: 5, container: "pack" }),
  line("sword", "Espada larga", { equipped: true }),
];
const info: Record<string, ItemInfo> = {
  dagger: { ...base, weight: 1, equippable: true, nameEn: "Dagger", type: "M", properties: ["F", "L", "T"] },
  potion: { ...base, weight: 0.5, nameEn: "Potion of Healing", type: "P", rarity: "rare" },
  pack: { ...base, weight: 5, nameEn: "Backpack", type: "G", container: { weight: 30, text: "1 pie cúbico", weightless: false } },
  rations: { ...base, weight: 2, nameEn: "Rations", type: "G" },
  sword: { ...base, weight: 3, equippable: true, nameEn: "Longsword", type: "M" },
};

describe("searchText", () => {
  it("pasa a minúsculas y quita tildes", () => {
    expect(searchText("Poción ÁRBOL")).toBe("pocion arbol");
  });
});

describe("matchesItem", () => {
  const dagger = items[0];
  it("q vacío casa con todo", () => {
    expect(matchesItem(dagger, undefined, "")).toBe(true);
  });
  it("busca en propiedades, tipo, rareza y nombre en inglés sin distinguir tildes ni mayúsculas", () => {
    expect(matchesItem(dagger, info.dagger, "arrojadiza")).toBe(true);
    expect(matchesItem(dagger, info.dagger, "ARROJADIZA")).toBe(true);
    expect(matchesItem(dagger, info.dagger, "Dagger")).toBe(true);
    expect(matchesItem(dagger, info.dagger, "cuerpo a cuerpo")).toBe(true);
    expect(matchesItem(items[1], info.potion, "pocion")).toBe(true);
    expect(matchesItem(items[1], info.potion, "raro")).toBe(true);
    expect(matchesItem(dagger, info.dagger, "zzz")).toBe(false);
  });
  it("sin datos del catálogo solo busca en el nombre", () => {
    expect(matchesItem(dagger, undefined, "daga")).toBe(true);
    expect(matchesItem(dagger, undefined, "dagger")).toBe(false);
  });
});

describe("inventoryChips", () => {
  it("Todo, Equipado, un chip por contenedor y Otras posesiones", () => {
    expect(inventoryChips(items, info).map((c) => c.id)).toEqual(["todo", "equipado", "pack", "otras"]);
    expect(inventoryChips(items, info)[2]).toEqual({ id: "pack", label: "Mochila" });
  });
  it("sin contenedores no hay chip intermedio", () => {
    expect(inventoryChips([items[0]], info).map((c) => c.id)).toEqual(["todo", "equipado", "otras"]);
  });
  it("una sección de un contenedor que ya no está vuelve a Todo", () => {
    const ids = inventoryChips([items[0]], info).map((c) => c.id);
    expect(parseSection("pack", ids)).toBe("todo");
    expect(parseSection("pack", inventoryChips(items, info).map((c) => c.id))).toBe("pack");
  });
});

describe("inventoryGroups", () => {
  it("todo: Equipo con lo suelto (contenedor incluido) y un grupo por contenedor", () => {
    const g = inventoryGroups(items, info, "todo", "");
    expect(g.map((x) => x.id)).toEqual(["equipo", "pack"]);
    expect(g[0]).toMatchObject({ title: "Equipo", container: null });
    expect(g[0].lines.map((l) => l.id)).toEqual(["dagger", "potion", "pack", "sword"]);
    expect(g[1].title).toBe("Mochila");
    expect(g[1].lines.map((l) => l.id)).toEqual(["rations"]);
    expect(g[1].container).toMatchObject({ weight: 10, over: false, capacity: { weight: 30 } });
    expect(g[1].container?.line.id).toBe("pack");
  });
  it("equipado: un solo grupo Equipo con las equipadas", () => {
    const g = inventoryGroups(items, info, "equipado", "");
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ id: "equipo", title: "Equipo", container: null });
    expect(g[0].lines.map((l) => l.id)).toEqual(["sword"]);
  });
  it("id de contenedor: solo ese grupo; otras: nada", () => {
    expect(inventoryGroups(items, info, "pack", "").map((x) => x.id)).toEqual(["pack"]);
    expect(inventoryGroups(items, info, "otras", "")).toEqual([]);
  });
  it("con búsqueda conserva solo las líneas que casan y omite grupos vacíos", () => {
    const g = inventoryGroups(items, info, "todo", "raciones");
    expect(g.map((x) => x.id)).toEqual(["pack"]);
    expect(g[0].lines.map((l) => l.id)).toEqual(["rations"]);
  });
  it("un contenedor vacío sale en todo", () => {
    const g = inventoryGroups([items[2]], info, "todo", "");
    expect(g.map((x) => x.id)).toEqual(["equipo", "pack"]);
    expect(g[1].lines).toEqual([]);
    expect(g[1].container?.weight).toBe(0);
  });
  it("over cuando el contenido pasa de la capacidad en peso", () => {
    const heavy = [...items.slice(0, 4), line("anvil", "Yunque", { container: "pack" })];
    const g = inventoryGroups(heavy, { ...info, anvil: { ...base, weight: 25 } }, "pack", "");
    expect(g[0].container).toMatchObject({ weight: 35, over: true });
  });
  it("over es falso sin capacidad en peso", () => {
    const loose = { ...info, pack: { ...info.pack, container: { weight: null, text: "12 pies cúbicos", weightless: false } } };
    expect(inventoryGroups(items, loose, "pack", "")[0].container?.over).toBe(false);
  });
});

describe("inventoryHref", () => {
  it("cambia q, conserva tab y el resto, y quita spell y saved", () => {
    expect(inventoryHref({ tab: "inventario", seccion: "equipado", saved: "1" }, { q: " daga " }))
      .toBe("?tab=inventario&seccion=equipado&q=daga");
    expect(inventoryHref({ tab: "inventario", spell: "x" }, {})).toBe("?tab=inventario");
  });
  it("sin q si queda vacío", () => {
    expect(inventoryHref({ tab: "inventario", q: "daga" }, { q: "  " })).toBe("?tab=inventario");
  });
  it("conserva q actual si no se cambia", () => {
    expect(inventoryHref({ tab: "inventario", q: "daga" }, {})).toBe("?tab=inventario&q=daga");
  });
});
