import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/lib/rules/dnd2024/sheet/sheet";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { ItemData } from "@/lib/rules/types";
import { itemDetails } from "@/lib/rules/dnd2024/sheet/itemDetails";

const line = (name: string, extra: Partial<InventoryItem> = {}): InventoryItem => ({
  id: "l1", ref: null, name, quantity: 1, equipped: false, notes: "", ...extra,
});
const entry = (data: Partial<ItemData> & { type: string }): CatalogEntry => ({
  ref: { bookId: "b", kind: "item", identifier: "x" },
  name: "X", nameEs: null, bookName: "PHB", srd52: true,
  data: { weight: 0, value: 0, ...data },
  description: "", descriptionEs: "", identifier: "x", parent: null, foundry: null,
} as unknown as CatalogEntry);
const labels = (d: { rows: { label: string; value: string }[] }) => d.rows.map((r) => r.label);
const row = (d: { rows: { label: string; value: string }[] }, label: string) => d.rows.find((r) => r.label === label)?.value;

describe("itemDetails", () => {
  it("espada larga: peso, coste, daño, propiedades y maestría", () => {
    const d = itemDetails(line("Espada larga"), entry({
      type: "M", weight: 3, value: 1500,
      weapon: { damage: "1d8", damageType: "S", properties: ["V"], mastery: "sap", category: "martial" },
    }), null);
    expect(d.name).toBe("Espada larga");
    expect(d.subtitle).toBe("Arma cuerpo a cuerpo");
    expect(d.rows).toEqual([
      { label: "Peso", value: "3 lb (1,36 kg)" },
      { label: "Coste", value: "15 po" },
      { label: "Daño", value: "1d8 cortante" },
      { label: "Propiedades", value: "Versátil" },
      { label: "Maestría", value: "Debilitar" },
      { label: "Cantidad", value: "1" },
    ]);
  });

  it("alcance en pies", () => {
    const d = itemDetails(line("Daga"), entry({
      type: "M", weapon: { damage: "1d4", damageType: "P", properties: ["F", "T"], category: "simple", range: "20/60" },
    }), null);
    expect(row(d, "Alcance")).toBe("20/60 pies");
    expect(row(d, "Propiedades")).toBe("Sutil, Arrojadiza");
  });

  it("cota de malla: CA y desventaja de sigilo", () => {
    const d = itemDetails(line("Cota de malla"), entry({
      type: "HA", armor: { ac: 16, dexCap: 0, stealthDisadvantage: true, category: "heavy" },
    }), null);
    expect(row(d, "CA")).toBe("16");
    expect(row(d, "Sigilo")).toBe("Desventaja");
  });

  it("escudo: CA con signo", () => {
    const d = itemDetails(line("Escudo"), entry({
      type: "S", armor: { ac: 2, dexCap: null, stealthDisadvantage: false, category: "shield" },
    }), null);
    expect(row(d, "CA")).toBe("+2");
    expect(labels(d)).not.toContain("Sigilo");
  });

  it("contenedor: capacidad por peso o por texto", () => {
    const container = { weight: 30, volume: null, items: [], weightless: false };
    expect(row(itemDetails(line("Mochila"), entry({ type: "G", container }), null), "Capacidad")).toBe("30 lb");
    expect(row(itemDetails(line("Cofre"), entry({ type: "G", container: { ...container, weight: null } }), "12 pies cúbicos"), "Capacidad"))
      .toBe("12 pies cúbicos");
  });

  it("contenedor sin peso del contenido: fila tras la capacidad", () => {
    const container = { weight: 500, volume: 64, items: [], weightless: true };
    const d = itemDetails(line("Bolsa de contención"), entry({ type: "G", container }), null);
    expect(labels(d).slice(-3)).toEqual(["Capacidad", "Peso del contenido", "Cantidad"]);
    expect(row(d, "Peso del contenido")).toBe("No cuenta para el peso cargado");
  });

  it("arma sin dados (red): sin fila de daño", () => {
    const d = itemDetails(line("Red"), entry({
      type: "R", weapon: { damage: "", damageType: "B", properties: [], mastery: null, category: "martial" },
    } as unknown as Partial<ItemData> & { type: string }), null);
    expect(labels(d)).not.toContain("Daño");
  });

  it("poción rara: subtítulo con rareza", () => {
    const d = itemDetails(line("Poción"), entry({ type: "P", rarity: "rare" }), null);
    expect(d.subtitle).toBe("Poción · Raro");
  });

  it("sin entrada: solo cantidad y notas", () => {
    expect(itemDetails(line("Regalo raro", { notes: "Regalo" }), undefined, null)).toEqual({
      name: "Regalo raro", subtitle: null,
      rows: [{ label: "Cantidad", value: "1" }, { label: "Notas", value: "Regalo" }],
    });
  });
});
