import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { derive } from "@/lib/rules/dnd2024/derive";
import { featureUses, scaleValue, usesVars } from "@/lib/rules/dnd2024/derive/featureUses";
import type { Dnd2024Sheet, Dnd2024SheetV2, LevelEntry } from "@/lib/rules/dnd2024/sheet/sheet";
import { upgradeSheet } from "@/lib/rules/dnd2024/sheet/upgrade";
import type { ClassData } from "@/lib/rules/types";
import { B, buildCatalog, ref } from "../fixtureCatalog";

const v1 = (): Dnd2024Sheet => ({
  version: 1,
  species: { ref: ref("species:elf|xphb"), name: "Elfo" },
  lineage: { ref: ref("lineage:drow|xphb"), name: "Drow" },
  background: { ref: ref("background:acolyte|xphb"), name: "Acólito", abilities: { wis: 2, int: 1 }, equipment: "A" },
  classes: [{ ref: ref("class:barbarian|xphb"), name: "Bárbaro", level: 1, subclass: null, skills: ["athletics", "intimidation"], equipment: "A" }],
  abilityMethod: "standard",
  baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  rolls: null,
  speciesChoices: { skills: ["perception"], size: null },
  alignment: "", appearance: "", age: "", languages: "", notes: "", xp: 0,
  hp: { max: null, current: null, temp: 0 },
});

const entries = buildCatalog(["class-barbarian.json", "class-fighter.json", "class-bard.json", "class-wizard.json"]);
const RAGE = `${B}:classFeature:rage|barbarian|xphb|1`;

// Hoja con los niveles dados: `[clase, niveles]` en orden
const sheetOf = (classes: [string, number][], extra: Partial<Dnd2024SheetV2> = {}): Dnd2024SheetV2 => {
  let i = 0;
  const s = upgradeSheet(v1(), entries, () => `id${++i}`);
  s.levels = [];
  const perClass = new Map<string, number>();
  for (const [name, count] of classes) {
    for (let k = 0; k < count; k++) {
      const classLevel = (perClass.get(name) ?? 0) + 1;
      perClass.set(name, classLevel);
      s.levels.push({
        n: s.levels.length + 1, class: { ref: ref(`class:${name}|xphb`), name }, classLevel,
        hp: { method: "average", value: 5 }, choices: [],
      } satisfies LevelEntry);
    }
  }
  return Object.assign(s, extra);
};
const usesOf = (s: Dnd2024SheetV2, cat = entries) => derive(s, cat).featureUses;
const find = (list: ReturnType<typeof usesOf>, key: string) => list.find((u) => u.key === key);

describe("featureUses", () => {
  it("Bárbaro 1: Furia 2 usos, descanso largo y 1 con el corto", () => {
    expect(find(usesOf(sheetOf([["barbarian", 1]])), RAGE)).toEqual({
      key: RAGE, name: expect.any(String), max: 2, used: 0, recovery: { long: "all", short: 1 },
    });
  });
  it("usados de la hoja, recortados al máximo", () => {
    expect(find(usesOf(sheetOf([["barbarian", 1]], { featureUses: { [RAGE]: 5 } })), RAGE)?.used).toBe(2);
    expect(find(usesOf(sheetOf([["barbarian", 1]], { featureUses: { [RAGE]: 1 } })), RAGE)?.used).toBe(1);
  });
  it("hoja antigua sin featureUses: todo disponible", () => {
    expect(usesOf(sheetOf([["barbarian", 1]])).every((u) => u.used === 0)).toBe(true);
  });
  it("multiclase Bárbaro 3 / Guerrero 1: la escala de Furia usa el nivel de Bárbaro", () => {
    const list = usesOf(sheetOf([["barbarian", 3], ["fighter", 1]]));
    expect(find(list, RAGE)?.max).toBe(3);
    expect(find(list, `${B}:classFeature:second wind|fighter|xphb|1`)).toMatchObject({ max: 2, recovery: { long: "all", short: 1 } });
  });
  it("Guerrero: Oleada de acción recupera todo con el corto e Indomitable crece por niveles", () => {
    const list = usesOf(sheetOf([["fighter", 9]]));
    expect(find(list, `${B}:classFeature:action surge|fighter|xphb|2`)).toMatchObject({ max: 1, recovery: { long: "all", short: "all" } });
    expect(find(list, `${B}:classFeature:indomitable|fighter|xphb|9`)).toMatchObject({ max: 1, recovery: { long: "all", short: "none" } });
    const l17 = usesOf(sheetOf([["fighter", 17]]));
    expect(find(l17, `${B}:classFeature:indomitable|fighter|xphb|9`)?.max).toBe(3);
    expect(find(l17, `${B}:classFeature:action surge|fighter|xphb|2`)?.max).toBe(2);
    // Una sola entrada por rasgo aunque el catálogo lo repita en los niveles 13 y 17
    expect(l17.filter((u) => u.key.includes("indomitable"))).toHaveLength(1);
  });
  it("Mago 1: Recuperación arcana 1 uso, solo descanso largo", () => {
    expect(find(usesOf(sheetOf([["wizard", 1]])), `${B}:classFeature:arcane recovery|wizard|xphb|1`))
      .toMatchObject({ max: 1, recovery: { long: "all", short: "none" } });
  });
  it("Bardo: Inspiración bárdica sin corto hasta el nivel 5", () => {
    const key = `${B}:classFeature:bardic inspiration|bard|xphb|1`;
    expect(find(usesOf(sheetOf([["bard", 1]])), key)).toMatchObject({ max: 1, recovery: { long: "all", short: "none" } });
    expect(find(usesOf(sheetOf([["bard", 5]])), key)).toMatchObject({ recovery: { long: "all", short: "all" } });
  });

  describe("datos de Foundry", () => {
    const WM = "classFeature:weapon mastery|barbarian|xphb|1";
    const withFoundry = (foundry: unknown) => {
      const cat = new Map(entries);
      cat.set(`${B}:${WM}`, { ...(entries.get(RAGE) as CatalogEntry), ref: ref(WM), name: "Weapon Mastery", foundry });
      return find(usesOf(sheetOf([["barbarian", 1]]), cat), `${B}:${WM}`);
    };
    it("sr recoverAll: el corto lo devuelve todo", () => {
      expect(withFoundry({ system: { "uses.max": "@prof", "uses.recovery": [{ period: "sr", type: "recoverAll" }] } }))
        .toMatchObject({ max: 2, recovery: { long: "all", short: "all" } });
    });
    it("sr formula: el corto devuelve el número evaluado", () => {
      const recovery = [{ period: "lr", type: "recoverAll" }, { period: "sr", type: "formula", formula: "1" }];
      expect(withFoundry({ system: { "uses.max": "3", "uses.recovery": recovery } }))
        .toMatchObject({ max: 3, recovery: { long: "all", short: 1 } });
    });
    it("sin recuperación solo el largo; máximo numérico; fórmula desconocida o menor que 1: sin contador", () => {
      expect(withFoundry({ system: { "uses.max": 2 } })).toMatchObject({ max: 2, recovery: { long: "all", short: "none" } });
      expect(withFoundry({ system: { "uses.max": "@scale.psi-warrior.die.number" } })).toBeUndefined();
      expect(withFoundry({ system: { "uses.max": "0" } })).toBeUndefined();
      expect(withFoundry({ system: {} })).toBeUndefined();
      expect(withFoundry(null)).toBeUndefined();
    });
  });

  it("especie: el propio grupo es el rasgo (Aguante incansable del orco)", () => {
    const vars = usesVars({ prof: 2, mods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } }, []);
    const groups = [{ title: "Orco", source: "species" as const, ref: ref("species:orc|xphb"), features: [] }];
    expect(featureUses(sheetOf([["barbarian", 1]]), entries, groups, vars)).toEqual([{
      key: `${B}:species:orc|xphb`, name: "Aguante incansable", max: 1, used: 0, recovery: { long: "all", short: "none" },
    }]);
  });
});

describe("scaleValue", () => {
  const data = (id: string, v: string) => ({ table: { columns: [{ id, label: id, values: [v] }] } }) as unknown as ClassData;
  it("solo celdas numéricas, y los alias de Foundry", () => {
    expect(scaleValue(data("rage-damage", "+2"), "barbarian", "rage-damage", 1)).toBe(2);
    expect(scaleValue(data("rages", "—"), "barbarian", "rages", 1)).toBeNull();
    expect(scaleValue(data("bardic-die", "1d6"), "bard", "inspiration", 1)).toBeNull();
    expect(scaleValue(data("focus-points", "4"), "monk", "focus", 1)).toBe(4);
    expect(scaleValue(data("wild-shape", "2"), "druid", "wild-shape-uses", 1)).toBe(2);
    expect(scaleValue(data("martial-arts", "6"), "monk", "die", 1)).toBe(6);
  });
  it("catálogo sin id de columnas: null", () => {
    expect(scaleValue({ table: { columns: [{ label: "Furias", values: ["2"] }] } } as unknown as ClassData, "barbarian", "rages", 1)).toBeNull();
    expect(scaleValue(undefined, "barbarian", "rages", 1)).toBeNull();
  });
});
