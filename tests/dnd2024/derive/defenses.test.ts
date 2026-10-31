import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { derive } from "@/lib/rules/dnd2024/derive";
import { defensesOf } from "@/lib/rules/dnd2024/derive/defenses";
import type { Choice, Dnd2024Sheet, InventoryItem } from "@/lib/rules/dnd2024/sheet/sheet";
import { upgradeSheet } from "@/lib/rules/dnd2024/sheet/upgrade";
import type { Defenses } from "@/lib/rules/types";
import { B, buildCatalog, ref } from "../fixtureCatalog";

const base = (): Dnd2024Sheet => ({
  version: 1,
  species: { ref: ref("species:dwarf|xphb"), name: "Enano" },
  lineage: null,
  background: { ref: ref("background:acolyte|xphb"), name: "Acólito", abilities: { wis: 2, int: 1 }, equipment: "A" },
  classes: [{
    ref: ref("class:barbarian|xphb"), name: "Bárbaro", level: 1, subclass: null, skills: ["athletics", "intimidation"], equipment: "A",
  }],
  abilityMethod: "standard",
  baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  rolls: null,
  speciesChoices: { skills: [], size: null },
  alignment: "", appearance: "", age: "", languages: "", notes: "", xp: 0,
  hp: { max: null, current: null, temp: 0 },
});

// Catálogo con una especie, un linaje, una dote y un anillo con las defensas dadas
function catalog(extra: { species?: Defenses; lineage?: Defenses; feat?: Defenses; ring?: Defenses }) {
  const entries = buildCatalog();
  const put = (key: string, name: string, data: object) => entries.set(`${B}:${key}`, {
    ref: ref(key), name, nameEs: null, bookName: "Libro", srd52: false, data, description: "", descriptionEs: "",
    identifier: key, parent: null, foundry: null,
  } as CatalogEntry);
  const speciesBase = entries.get(`${B}:species:elf|xphb`)!.data as object;
  put("species:dwarf|xphb", "Enano", { ...speciesBase, defenses: extra.species });
  if (extra.lineage) put("lineage:dragon|xphb", "Dracónido rojo", { ...(entries.get(`${B}:lineage:drow|xphb`)!.data as object), defenses: extra.lineage });
  put("feat:tough-ish|xphb", "Dote", { category: "general", defenses: extra.feat });
  put("item:ring|xphb", "Anillo", { defenses: extra.ring });
  return entries;
}
const ringLine = (equipped: boolean): InventoryItem => ({ id: "r", ref: ref("item:ring|xphb"), name: "Anillo", quantity: 1, equipped, notes: "" });
const dwarf = (entries: Map<string, CatalogEntry>, items: InventoryItem[] = [], choices: Choice[] = []) => {
  const s = upgradeSheet(base(), entries, () => "id");
  s.inventory.items.push(...items);
  s.levels[0].choices.push(...choices);
  return s;
};

describe("defensesOf", () => {
  it("agrupa por tipo con todas las fuentes y ordena por clase de defensa", () => {
    const rows = defensesOf([
      { name: "A", defenses: { immune: ["poison"], resist: ["fire"] } },
      { name: "B", defenses: { resist: ["fire", "cold"], conditionImmune: ["frightened"] } },
    ]);
    expect(rows).toEqual([
      { kind: "resist", type: "fire", sources: ["A", "B"] },
      { kind: "resist", type: "cold", sources: ["B"] },
      { kind: "immune", type: "poison", sources: ["A"] },
      { kind: "conditionImmune", type: "frightened", sources: ["B"] },
    ]);
  });
  it("un choose usa lo elegido o sale «a elegir»", () => {
    const defenses = { resist: [{ choose: { from: ["cold", "fire"], count: 2 } }] };
    expect(defensesOf([{ name: "D", defenses, chosen: ["cold", "fire"] }])).toEqual([
      { kind: "resist", type: "cold", sources: ["D"] }, { kind: "resist", type: "fire", sources: ["D"] },
    ]);
    expect(defensesOf([{ name: "D", defenses }])).toEqual([{ kind: "resist", type: null, sources: ["D"] }]);
  });
});

describe("derive: defensas", () => {
  it("la especie da su resistencia", () => {
    const d = derive(base(), catalog({ species: { resist: ["poison"] } }));
    expect(d.defenses).toEqual([{ kind: "resist", type: "poison", sources: ["Enano"] }]);
  });
  it("un objeto equipado suma su fuente; sin equipar no cuenta", () => {
    const entries = catalog({ species: { resist: ["poison"] }, ring: { resist: ["poison"] } });
    expect(derive(dwarf(entries, [ringLine(true)]), entries).defenses)
      .toEqual([{ kind: "resist", type: "poison", sources: ["Enano", "Anillo"] }]);
    expect(derive(dwarf(entries, [ringLine(false)]), entries).defenses)
      .toEqual([{ kind: "resist", type: "poison", sources: ["Enano"] }]);
  });
  it("una dote con choose usa lo elegido o sale «a elegir»", () => {
    const entries = catalog({ feat: { resist: [{ choose: { from: ["cold", "fire", "acid"], count: 2 } }] } });
    const pick = (resist?: string[]): Choice => ({
      type: "feat", source: "feat:test", value: [{ ref: ref("feat:tough-ish|xphb"), name: "Dote", ...(resist ? { resist } : {}) }],
    });
    expect(derive(dwarf(entries, [], [pick(["cold", "fire"])]), entries).defenses.map((r) => r.type)).toEqual(["cold", "fire"]);
    expect(derive(dwarf(entries, [], [pick()]), entries).defenses).toEqual([{ kind: "resist", type: null, sources: ["Dote"] }]);
  });
  it("una especie con choose y sin linaje sale «a elegir» sin lanzar", () => {
    const d = derive(base(), catalog({ species: { resist: [{ choose: { from: ["acid", "fire"], count: 1 } }] } }));
    expect(d.defenses).toEqual([{ kind: "resist", type: null, sources: ["Enano"] }]);
  });
  it("las defensas del linaje sustituyen a las de la especie", () => {
    const entries = catalog({
      species: { resist: [{ choose: { from: ["acid", "fire"], count: 1 } }] }, lineage: { resist: ["acid"] },
    });
    const s = { ...base(), lineage: { ref: ref("lineage:dragon|xphb"), name: "Dracónido rojo" } };
    expect(derive(s, entries).defenses).toEqual([{ kind: "resist", type: "acid", sources: ["Dracónido rojo"] }]);
  });
});
