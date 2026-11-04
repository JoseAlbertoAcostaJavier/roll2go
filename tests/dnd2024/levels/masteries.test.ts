import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { isMasteryWeapon, masteryCount, masteryLabel, validateMasteries } from "@/lib/rules/dnd2024/levels/masteries";
import type { Dnd2024SheetV2, LevelEntry } from "@/lib/rules/dnd2024/sheet/sheet";
import type { ItemData } from "@/lib/rules/types";
import { B, buildCatalog, ref } from "../fixtureCatalog";

const catalog = buildCatalog(["class-barbarian.json", "class-cleric.json"]);
const weapon = (key: string, w: Partial<NonNullable<ItemData["weapon"]>>, type = "M"): CatalogEntry => ({
  ref: ref(key), name: key, nameEs: null, bookName: "Libro", srd52: true, description: "", descriptionEs: "",
  identifier: "", page: null, parent: null, foundry: null,
  data: { type, weight: 1, value: 1, weapon: { damage: "1d6", damageType: "S", properties: [], category: "martial", ...w } },
});
for (const e of [
  weapon("item:shortsword|xphb", { mastery: "vex", properties: ["F", "L"] }),
  weapon("item:longbow|xphb", { mastery: "slow" }, "R"),
  weapon("item:old sword|hb", {}),
  weapon("item:net|xphb", { mastery: "topple", category: "" }),
]) catalog.set(`${B}:${e.ref.key}`, e);

const martial = (item: CatalogEntry) => ["simple", "martial"].includes((item.data as ItemData).weapon?.category ?? "");
const ctx = (allowed: number, proficientWith = martial, meleeOnly = true) =>
  ({ allowed, entries: catalog, proficientWith, meleeOnly });
const items = (...names: string[]) => names.map((n) => ref(`item:${n}|xphb`));

describe("validateMasteries", () => {
  it("acepta tantas armas cuerpo a cuerpo con maestría y competencia como permite la clase", () => {
    expect(validateMasteries(items("greataxe", "handaxe"), ctx(2))).toEqual({ ok: true });
  });
  it("más armas de las permitidas, o repetidas → error", () => {
    expect(validateMasteries(items("greataxe", "handaxe", "shortsword"), ctx(2)).ok).toBe(false);
    expect(validateMasteries(items("greataxe", "greataxe"), ctx(2)).ok).toBe(false);
    expect(validateMasteries(items("greataxe"), ctx(2)).ok).toBe(false);
  });
  it("armas a distancia: sí, salvo con meleeOnly (Bárbaro)", () => {
    expect(validateMasteries(items("greataxe", "longbow"), ctx(2, martial, false))).toEqual({ ok: true });
    expect(validateMasteries(items("greataxe", "longbow"), ctx(2))).toMatchObject({ ok: false, error: expect.stringMatching(/cuerpo a cuerpo/) });
  });
  it("arma sin propiedad de maestría, o que no es sencilla ni marcial → error", () => {
    expect(validateMasteries([ref("item:greataxe|xphb"), ref("item:old sword|hb")], ctx(2)).ok).toBe(false);
    expect(validateMasteries(items("greataxe", "net"), ctx(2)).ok).toBe(false);
  });
  it("arma sin competencia → error", () => {
    const simpleOnly = (item: CatalogEntry) => (item.data as ItemData).weapon?.category === "simple";
    expect(validateMasteries(items("greataxe", "handaxe"), ctx(2, simpleOnly))).toMatchObject({
      ok: false, error: expect.stringMatching(/competencia/),
    });
  });
  it("algo que no es un arma del catálogo, o mal formado → error", () => {
    expect(validateMasteries(items("greataxe", "nope"), ctx(2)).ok).toBe(false);
    expect(validateMasteries([ref("item:greataxe|xphb"), { book: B }] as never, ctx(2)).ok).toBe(false);
    expect(validateMasteries("x" as never, ctx(2)).ok).toBe(false);
  });
});

describe("isMasteryWeapon", () => {
  const data = (type: string, extra: Partial<ItemData> = {}): ItemData => ({
    type, weight: 4, value: 20,
    weapon: { damage: "1d6", damageType: "B", properties: ["V"], mastery: "topple", category: "simple" }, ...extra,
  });
  it("solo armas cuerpo a cuerpo o a distancia: no un foco arcano con datos de arma (Bastón arcano)", () => {
    expect(isMasteryWeapon(data("M"))).toBe(true);
    expect(isMasteryWeapon(data("R"))).toBe(true);
    expect(isMasteryWeapon(data("SCF"))).toBe(false);
  });
  it("solo objetos base: no un arma mágica", () => {
    expect(isMasteryWeapon(data("M", { rarity: "rare" }))).toBe(false);
  });
});

describe("masteryCount y masteryLabel", () => {
  const sheetWith = (levels: [string, number][]): Dnd2024SheetV2 => {
    const list: LevelEntry[] = [];
    for (const [cls, n] of levels) {
      for (let i = 1; i <= n; i++) {
        list.push({
          n: list.length + 1, class: { ref: ref(`class:${cls}|xphb`), name: cls }, classLevel: i,
          hp: { method: "average", value: 7 }, choices: [],
        });
      }
    }
    return { levels: list } as Dnd2024SheetV2;
  };
  it("suma la progresión de cada clase a su nivel", () => {
    expect(masteryCount(sheetWith([["barbarian", 1]]), catalog)).toBe(2);
    expect(masteryCount(sheetWith([["barbarian", 4]]), catalog)).toBe(3);
    expect(masteryCount(sheetWith([["cleric", 3]]), catalog)).toBe(0);
  });
  it("«Espada corta (Vejar)»", () => {
    expect(masteryLabel("Espada corta", "vex")).toBe("Espada corta (Vejar)");
  });
});
