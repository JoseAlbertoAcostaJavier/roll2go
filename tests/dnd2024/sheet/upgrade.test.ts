import { describe, expect, it } from "vitest";
import { derive } from "@/lib/rules/dnd2024/derive";
import type { Dnd2024Sheet, LevelEntry } from "@/lib/rules/dnd2024/sheet/sheet";
import { loadUpgradeEntries, missingForUpgrade, summarizeClasses, upgradeSheet } from "@/lib/rules/dnd2024/sheet/upgrade";
import { B, buildCatalog, ref } from "../fixtureCatalog";

const counter = () => {
  let i = 0;
  return () => `id${++i}`;
};
const catalog = buildCatalog();

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
  speciesChoices: { skills: ["perception"], size: null },
  alignment: "", appearance: "", age: "", languages: "", notes: "Notas", xp: 0,
  hp: { max: null, current: null, temp: 0 },
});

describe("upgradeSheet", () => {
  const s = upgradeSheet(v1(), catalog, counter());

  it("convierte la clase en el nivel 1 del historial", () => {
    expect(s.version).toBe(2);
    expect(s).not.toHaveProperty("classes");
    expect(s.levels).toHaveLength(1);
    expect(s.levels[0]).toEqual({
      n: 1,
      class: { ref: ref("class:barbarian|xphb"), name: "Bárbaro" },
      classLevel: 1,
      hp: { method: "max", value: 12 },
      choices: [{ type: "skills", source: "class:skills", value: ["athletics", "intimidation"] }],
      equipment: "A",
    });
    expect(s.classesSummary).toEqual([
      { class: { ref: ref("class:barbarian|xphb"), name: "Bárbaro" }, level: 1, subclass: null },
    ]);
  });

  it("vuelca el equipo inicial al inventario", () => {
    expect(s.inventory.coins.gp).toBe(23);
    const byKey = (key: string) => s.inventory.items.find((i) => i.ref?.key === key);
    expect(byKey("item:greataxe|xphb")?.equipped).toBe(true);
    expect(byKey("item:handaxe|xphb")).toMatchObject({ quantity: 4, equipped: true });
    expect(byKey("item:backpack|xphb")?.equipped).toBe(false);
  });

  it("conserva el resto de la hoja y empieza vacío lo nuevo", () => {
    expect(s.background.equipment).toBe("A");
    expect(s.notes).toBe("Notas");
    expect(s.speciesChoices.skills).toEqual(["perception"]);
    expect(s.prepared).toEqual({});
    expect(s.spellbookExtra).toEqual([]);
    expect(s.slotsUsed).toEqual({});
    expect(s.hitDiceUsed).toEqual({});
  });

  it("con la clase borrada del catálogo pone 0 PG y vuelca solo el trasfondo", () => {
    const entries = buildCatalog();
    entries.delete(`${B}:class:barbarian|xphb`);
    const r = upgradeSheet(v1(), entries, counter());
    expect(r.levels[0].hp.value).toBe(0);
    expect(r.inventory.coins.gp).toBe(8);
  });

  it("es idempotente: una v2 se devuelve igual", () => {
    expect(upgradeSheet(s, catalog, counter())).toBe(s);
  });
});

describe("summarizeClasses", () => {
  const cls = (key: string, name: string) => ({ ref: ref(key), name });
  const level = (n: number, c: ReturnType<typeof cls>, classLevel: number, choices: LevelEntry["choices"] = []): LevelEntry =>
    ({ n, class: c, classLevel, hp: { method: "average", value: 7 }, choices });

  it("agrupa por clase en orden de aparición, con nivel y subclase", () => {
    const barb = cls("class:barbarian|xphb", "Bárbaro");
    const fighter = cls("class:fighter|xphb", "Guerrero");
    const berserker = cls("subclass:berserker|barbarian|xphb", "Berserker");
    const r = summarizeClasses([
      level(1, barb, 1),
      level(2, barb, 2),
      level(3, fighter, 1),
      level(4, barb, 3, [{ type: "subclass", source: "x", value: berserker }]),
    ]);
    expect(r).toEqual([
      { class: barb, level: 3, subclass: berserker },
      { class: fighter, level: 1, subclass: null },
    ]);
  });
});

describe("missingForUpgrade", () => {
  it("vacío si están la clase y el trasfondo", () => {
    expect(missingForUpgrade(v1(), catalog)).toEqual([]);
  });
  it("nombres guardados de la clase o el trasfondo que faltan", () => {
    const entries = buildCatalog();
    entries.delete(`${B}:class:barbarian|xphb`);
    expect(missingForUpgrade(v1(), entries)).toEqual(["Bárbaro"]);
    entries.delete(`${B}:background:acolyte|xphb`);
    expect(missingForUpgrade(v1(), entries)).toEqual(["Bárbaro", "Acólito"]);
  });
});

describe("loadUpgradeEntries", () => {
  it("carga la clase, el trasfondo y el equipo elegido con el contenido de los paquetes", async () => {
    const asked: string[] = [];
    const entries = await loadUpgradeEntries(v1(), async (r) => {
      asked.push(r.key);
      return catalog.get(`${r.book}:${r.key}`) ?? null;
    });
    expect(asked.slice(0, 2)).toEqual(["class:barbarian|xphb", "background:acolyte|xphb"]);
    expect(entries.has(`${B}:item:greataxe|xphb`)).toBe(true);
    expect(entries.has(`${B}:item:explorer's pack|xphb`)).toBe(true);
    // Con estas entradas la conversión es la misma que con todo el catálogo
    expect(upgradeSheet(v1(), entries, counter())).toEqual(upgradeSheet(v1(), catalog, counter()));
  });
});

describe("conversión y valores derivados", () => {
  it("una v1 y su v2 dan los mismos valores derivados", () => {
    const original = v1();
    // (los ids de línea de los ataques dependen de cómo se numeran las líneas: no se comparan)
    const sansIds = (d: ReturnType<typeof derive>) => ({ ...d, attacks: d.attacks.map((a) => ({ ...a, lineId: undefined })), weaponCards: undefined });
    expect(sansIds(derive(upgradeSheet(original, catalog, counter()), catalog))).toEqual(sansIds(derive(original, catalog)));
  });
});
