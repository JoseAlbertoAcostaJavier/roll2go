import { describe, expect, it } from "vitest";
import { creationDraft, creationUpdate } from "@/lib/rules/dnd2024/recreate";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet";
import { ref } from "./fixtureCatalog";

const named = (key: string, name = key) => ({ ref: ref(key), name });

const sheet = (): Dnd2024SheetV2 => ({
  version: 2,
  species: named("species:elf|xphb"),
  lineage: named("lineage:drow|xphb"),
  background: { ...named("background:acolyte|xphb"), abilities: { int: 2, wis: 1 }, equipment: "B" },
  abilityMethod: "roll",
  baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  rolls: { values: [15, 14, 13, 12, 10, 8], token: "1.abc" },
  speciesChoices: { skills: ["Perception"], size: null },
  alignment: "lg",
  appearance: "Alta",
  age: "120",
  languages: "Élfico",
  notes: "Notas",
  xp: 50,
  hp: { max: null, current: 3, temp: 2 },
  levels: [{
    n: 1,
    class: named("class:fighter|xphb", "Guerrero"),
    classLevel: 1,
    hp: { method: "max", value: 10 },
    equipment: "A",
    choices: [
      { type: "skills", source: "skills", value: ["Athletics", "Insight"] },
      { type: "weaponMastery", source: "mastery", value: [ref("item:longsword|xphb"), ref("item:dagger|xphb")] },
      { type: "featureOption", source: "classFeature:fighting style|fighter|xphb|1", value: named("feat:archery|xphb") },
      { type: "feat", source: "feats", value: [named("feat:alert|xphb")] },
      { type: "optionalFeature", source: "invocations", value: [named("optionalFeature:agonizing blast|xphb")] },
      { type: "subclass", source: "subclass", value: named("subclass:champion|fighter|xphb") },
    ],
  }],
  classesSummary: [{ class: named("class:fighter|xphb", "Guerrero"), level: 1, subclass: null }],
  inventory: { items: [], coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, other: "" },
  prepared: { "class:fighter|xphb": [ref("spell:x|xphb")] },
  spellbookExtra: [],
  slotsUsed: { "1": 1 },
  weaponMasteries: [ref("item:longsword|xphb")],
});

describe("creationDraft", () => {
  it("vuelca la hoja y los datos del personaje en el formato del borrador del creador", () => {
    const d = creationDraft({ name: "Ana", pronouns: ["she"], status: "active", backstory: "Historia" }, sheet());
    expect(d).toMatchObject({
      name: "Ana", pronouns: ["she"], status: "active", backstory: "Historia",
      species: ref("species:elf|xphb"), lineage: ref("lineage:drow|xphb"),
      speciesSkills: ["Perception"], size: null,
      background: ref("background:acolyte|xphb"), bonus: { int: 2, wis: 1 }, bgEquipment: "B",
      klass: ref("class:fighter|xphb"), classEquipment: "A",
      method: "roll", base: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      rolls: { values: [15, 14, 13, 12, 10, 8], token: "1.abc" },
      alignment: "lg", appearance: "Alta", age: "120", languages: "Élfico", notes: "Notas", xp: "50",
    });
  });
  it("pasa las elecciones de nivel 1 a valores por fuente (claves `libro:clave` para las entradas)", () => {
    const d = creationDraft({ name: "Ana", pronouns: [], status: "active", backstory: "" }, sheet());
    const k = (key: string) => `${ref(key).book}:${key}`;
    expect(d.classChoices).toEqual({
      skills: ["Athletics", "Insight"],
      mastery: [k("item:longsword|xphb"), k("item:dagger|xphb")],
      "classFeature:fighting style|fighter|xphb|1": [k("feat:archery|xphb")],
      feats: [k("feat:alert|xphb")],
      invocations: [k("optionalFeature:agonizing blast|xphb")],
    });
  });
});

describe("creationUpdate", () => {
  it("sustituye los datos de creación, el nivel 1, el inventario y lo que depende de la clase", () => {
    const next = sheet();
    const set = creationUpdate(next);
    expect(Object.keys(set).sort()).toEqual([
      "sheet.abilityMethod", "sheet.background", "sheet.baseAbilities", "sheet.classesSummary", "sheet.hp",
      "sheet.inventory", "sheet.levels", "sheet.lineage", "sheet.prepared", "sheet.rolls", "sheet.slotsUsed",
      "sheet.species", "sheet.speciesChoices", "sheet.spellbookExtra", "sheet.weaponMasteries",
    ]);
    expect(set["sheet.levels"]).toBe(next.levels);
    expect(set["sheet.inventory"]).toBe(next.inventory);
  });
  it("no toca los textos ni la experiencia", () => {
    const set = creationUpdate(sheet());
    for (const k of ["alignment", "appearance", "age", "languages", "notes", "xp"]) expect(set).not.toHaveProperty(`sheet.${k}`);
  });
});
