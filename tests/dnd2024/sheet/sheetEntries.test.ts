import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { Dnd2024Sheet, Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import { loadSheetEntries } from "@/lib/rules/dnd2024/sheet/sheetEntries";
import { upgradeSheet } from "@/lib/rules/dnd2024/sheet/upgrade";
import type { Ref } from "@/lib/rules/types";
import { B, buildCatalog, ref } from "../fixtureCatalog";

const catalog = buildCatalog();

// Consulta en lote falsa sobre el catálogo de prueba; guarda cada lote pedido
function fetcher() {
  const calls: Ref[][] = [];
  const fetch = async (refs: Ref[]) => {
    calls.push(refs);
    return refs.map((r) => catalog.get(refKey(r))).filter((e): e is CatalogEntry => !!e);
  };
  return { calls, fetch };
}

const v1 = (): Dnd2024Sheet => ({
  version: 1,
  species: { ref: ref("species:elf|xphb"), name: "Elfo" },
  lineage: { ref: ref("lineage:drow|xphb"), name: "Drow" },
  background: { ref: ref("background:acolyte|xphb"), name: "Acólito", abilities: { wis: 2, int: 1 }, equipment: "A" },
  classes: [{
    ref: ref("class:barbarian|xphb"), name: "Bárbaro", level: 1, subclass: null,
    skills: ["athletics", "intimidation"], equipment: "A",
  }],
  abilityMethod: "standard",
  baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  rolls: null,
  speciesChoices: { skills: [], size: null },
  alignment: "", appearance: "", age: "", languages: "", notes: "", xp: 0,
  hp: { max: null, current: null, temp: 0 },
});

// Bárbaro 3 con la Senda del berserker
const v2 = (): Dnd2024SheetV2 => {
  let i = 0;
  const s = upgradeSheet(v1(), catalog, () => `id${++i}`);
  const berserker = { ref: ref("subclass:path of the berserker|barbarian|xphb"), name: "Senda del berserker" };
  for (const n of [2, 3]) {
    s.levels.push({
      n, class: s.levels[0].class, classLevel: n, hp: { method: "average", value: 7 },
      choices: n === 3 ? [{ type: "subclass", source: "x", value: berserker }] : [],
    });
  }
  return s;
};

describe("loadSheetEntries", () => {
  it("carga especie, legado, trasfondo, dote de origen, clase, subclase e inventario", async () => {
    const sheet = v2();
    const { fetch } = fetcher();
    const entries = await loadSheetEntries(sheet, [B], fetch);
    for (const key of [
      "species:elf|xphb", "lineage:drow|xphb", "background:acolyte|xphb", "feat:magic initiate; cleric|xphb",
      "class:barbarian|xphb", "subclass:path of the berserker|barbarian|xphb",
    ]) expect(entries.has(`${B}:${key}`), key).toBe(true);
    // Los objetos del inventario que existen en el catálogo de prueba
    const items = sheet.inventory.items.filter((i) => i.ref && catalog.has(refKey(i.ref)));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(entries.has(refKey(item.ref!)), item.name).toBe(true);
  });

  it("pide los rasgos de clase y subclase solo hasta el nivel actual", async () => {
    const { calls, fetch } = fetcher();
    await loadSheetEntries(v2(), [B], fetch);
    const asked = calls.flat().map((r) => r.key);
    expect(asked.some((k) => k.startsWith("classFeature:rage|barbarian"))).toBe(true);
    expect(asked.some((k) => k.startsWith("subclassFeature:"))).toBe(true);
    const levelOf = (k: string) => Number(k.split("|").at(-1));
    expect(asked.filter((k) => k.startsWith("classFeature:")).every((k) => levelOf(k) <= 3)).toBe(true);
  });

  it("carga los rasgos opcionales que conserva y las opciones de rasgo del catálogo (no las escritas a mano)", async () => {
    const sheet = v2();
    sheet.levels[1].choices = [
      { type: "optionalFeature", source: "p", value: [{ ref: ref("optionalFeature:careful spell|xphb"), name: "x" }] },
      { type: "featureOption", source: "f", value: { ref: ref("classFeature:protector|cleric|xphb|1"), name: "x" } },
      { type: "featureOption", source: "g", value: { ref: { book: "builtin", key: "option:hunters-prey:horde-breaker" }, name: "x" } },
    ];
    const { calls, fetch } = fetcher();
    await loadSheetEntries(sheet, [B], fetch);
    const asked = calls.flat().map((r) => r.key);
    expect(asked).toContain("optionalFeature:careful spell|xphb");
    expect(asked).toContain("classFeature:protector|cleric|xphb|1");
    expect(asked.some((k) => k.startsWith("option:"))).toBe(false);
  });

  it("no repite referencias y consulta por tandas", async () => {
    const { calls, fetch } = fetcher();
    await loadSheetEntries(v2(), [B], fetch);
    const keys = calls.flat().map(refKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(calls.length).toBeLessThanOrEqual(4);
  });

  it("hoja v1: carga el equipo inicial elegido para convertirla", async () => {
    const { fetch } = fetcher();
    const entries = await loadSheetEntries(v1(), [B], fetch);
    expect(entries.has(`${B}:item:greataxe|xphb`)).toBe(true);
    const upgraded = upgradeSheet(v1(), entries, () => "x");
    expect(upgraded.inventory.items.length).toBeGreaterThan(0);
  });

  it("solo consulta los libros permitidos", async () => {
    const { calls, fetch } = fetcher();
    const entries = await loadSheetEntries(v2(), ["otro-libro"], fetch);
    expect(entries.size).toBe(0);
    // Solo se piden los idiomas fijos (están en cualquier libro permitido)
    expect(calls.flat().every((r) => r.book === "otro-libro" && r.key.startsWith("language:"))).toBe(true);
  });
});
