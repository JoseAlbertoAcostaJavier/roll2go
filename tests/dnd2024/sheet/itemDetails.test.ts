import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/lib/rules/dnd2024/sheet/sheet";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { Ability, ItemData } from "@/lib/rules/types";
import { weaponAttack } from "@/lib/rules/dnd2024/derive/attacks";
import { itemDetails, locationText } from "@/lib/rules/dnd2024/sheet/itemDetails";
import { MASTERY_TEXTS } from "@/lib/rules/dnd2024/sheet/labels";

const line = (name: string, extra: Partial<InventoryItem> = {}): InventoryItem => ({
  id: "l1", ref: null, name, quantity: 1, equipped: false, notes: "", ...extra,
});
const entry = (data: Partial<ItemData> & { type: string }): CatalogEntry => ({
  ref: { bookId: "b", kind: "item", identifier: "x" },
  name: "X", nameEs: null, bookName: "PHB", srd52: true,
  data: { weight: 0, value: 0, ...data },
  description: "", descriptionEs: "", identifier: "x", page: null, parent: null, foundry: null,
} as unknown as CatalogEntry);
const ctx = (extra: Partial<Parameters<typeof itemDetails>[2]> = {}) => ({ capacityText: null, location: "En Equipo", ...extra });
const labels = (d: { rows: { label: string; value: string }[] }) => d.rows.map((r) => r.label);
const row = (d: { rows: { label: string; value: string }[] }, label: string) => d.rows.find((r) => r.label === label)?.value;
const mods = (m: Partial<Record<Ability, number>>): Record<Ability, number> =>
  ({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, ...m });

const greataxe = entry({
  type: "M", weight: 7, value: 3000,
  weapon: { damage: "1d12", damageType: "S", properties: ["H", "2H"], mastery: "cleave", category: "martial" },
});

describe("itemDetails", () => {
  it("gran hacha con el ataque del personaje: filas de arma, subtítulo y ubicación", () => {
    const attack = weaponAttack({ ...(greataxe.data as ItemData), name: "Gran hacha" }, mods({ str: 3 }), 2, true, true);
    const d = itemDetails(line("Gran hacha"), greataxe, ctx({ attack, proficient: true, bookName: "Manual del Jugador", hasMastery: true }));
    expect(d.icon).toBe("weapon");
    expect(d.subtitle).toBe("Arma, común");
    expect(d.location).toBe("En Equipo");
    expect(d.rows.slice(0, -1)).toEqual([
      { label: "Competente", value: "Sí" },
      { label: "Tipo de ataque", value: "Cuerpo a cuerpo" },
      { label: "Alcance", value: "1,5 m" },
      { label: "Daño", value: "1d12+3" },
      { label: "Tipo de daño", value: "Cortante", icon: "slashing" },
      { label: "Peso", value: "7 lb (3,18 kg)" },
      { label: "Coste", value: "30 po" },
      { label: "Propiedades", value: "Pesada, A dos manos" },
      { label: "Fuente", value: "Manual del Jugador" },
    ]);
    expect(d.mastery).toEqual({ name: "Hendir", text: MASTERY_TEXTS.cleave });
  });

  it("arma sin ataque (no equipada): daño base, competencia dada y sin maestría si no la tiene", () => {
    const d = itemDetails(line("Gran hacha"), greataxe, ctx({ proficient: false }));
    expect(row(d, "Competente")).toBe("No");
    expect(row(d, "Daño")).toBe("1d12");
    expect(row(d, "Alcance")).toBe("1,5 m");
    expect(d.mastery).toBeNull();
  });

  it("arma a distancia: tipo de ataque y alcance", () => {
    const d = itemDetails(line("Arco corto"), entry({
      type: "R", weapon: { damage: "1d6", damageType: "P", properties: ["A"], category: "simple", range: "80/320" },
    }), ctx());
    expect(row(d, "Tipo de ataque")).toBe("A distancia");
    expect(row(d, "Alcance")).toBe("24/96 m");
  });

  it("raciones: peso, coste y fuente", () => {
    const d = itemDetails(line("Raciones"), { ...entry({ type: "G", weight: 2, value: 50 }), bookName: "Manual del Jugador" } as CatalogEntry,
      ctx({ bookName: "Manual del Jugador" }));
    expect(d.icon).toBe("item");
    expect(d.rows.slice(0, 3)).toEqual([
      { label: "Peso", value: "2 lb (0,91 kg)" },
      { label: "Coste", value: "0,5 po" },
      { label: "Fuente", value: "Manual del Jugador" },
    ]);
    expect(d.mastery).toBeNull();
  });

  it("cota de malla: CA y desventaja de sigilo", () => {
    const d = itemDetails(line("Cota de malla"), entry({
      type: "HA", armor: { ac: 16, dexCap: 0, stealthDisadvantage: true, category: "heavy" },
    }), ctx());
    expect(row(d, "CA")).toBe("16");
    expect(row(d, "Sigilo")).toBe("Desventaja");
  });

  it("escudo: CA con signo", () => {
    const d = itemDetails(line("Escudo"), entry({
      type: "S", armor: { ac: 2, dexCap: null, stealthDisadvantage: false, category: "shield" },
    }), ctx());
    expect(row(d, "CA")).toBe("+2");
    expect(labels(d)).not.toContain("Sigilo");
  });

  it("contenedor: capacidad por peso o por texto", () => {
    const container = { weight: 30, volume: null, items: [], weightless: false };
    expect(row(itemDetails(line("Mochila"), entry({ type: "G", container }), ctx()), "Capacidad")).toBe("30 lb");
    expect(row(itemDetails(line("Cofre"), entry({ type: "G", container: { ...container, weight: null } }), ctx({ capacityText: "12 pies cúbicos" })), "Capacidad"))
      .toBe("12 pies cúbicos");
  });

  it("contenedor sin peso del contenido: fila tras la capacidad", () => {
    const container = { weight: 500, volume: 64, items: [], weightless: true };
    const d = itemDetails(line("Bolsa de contención"), entry({ type: "G", container }), ctx());
    expect(labels(d).slice(-3)).toEqual(["Capacidad", "Peso del contenido", "Cantidad"]);
  });

  it("arma sin dados (red): sin fila de daño", () => {
    const d = itemDetails(line("Red"), entry({
      type: "R", weapon: { damage: "", damageType: "B", properties: [], mastery: null, category: "martial" },
    } as unknown as Partial<ItemData> & { type: string }), ctx());
    expect(labels(d)).not.toContain("Daño");
  });

  it("poción rara: subtítulo con rareza", () => {
    const d = itemDetails(line("Poción"), entry({ type: "P", rarity: "rare" }), ctx());
    expect(d.subtitle).toBe("Poción, raro");
  });

  it("sin entrada: solo cantidad y notas", () => {
    expect(itemDetails(line("Regalo raro", { notes: "Regalo" }), undefined, ctx())).toEqual({
      name: "Regalo raro", subtitle: null, location: "En Equipo", icon: "item", mastery: null,
      rows: [{ label: "Cantidad", value: "1" }, { label: "Notas", value: "Regalo" }],
    });
  });
});

describe("locationText", () => {
  const info = { c1: { weight: 1, container: { weightless: false } } };
  it("suelto: Equipo; en un contenedor: su nombre", () => {
    const items = [line("Mochila", { id: "c1" }), line("Cuerda", { id: "l2", container: "c1" }), line("Pan", { id: "l3" })];
    expect(locationText(items[1], items, info)).toBe("En Mochila");
    expect(locationText(items[2], items, info)).toBe("En Equipo");
  });
});

describe("MASTERY_TEXTS", () => {
  it("las 8 maestrías tienen texto", () => {
    for (const k of ["cleave", "graze", "nick", "push", "sap", "slow", "topple", "vex"]) {
      expect(MASTERY_TEXTS[k]?.length).toBeGreaterThan(20);
    }
  });
});
