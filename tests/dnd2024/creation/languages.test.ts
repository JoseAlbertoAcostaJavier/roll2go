import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { checkLanguages, fixedLanguages, languageSlots } from "@/lib/rules/dnd2024/creation/languages";
import { derive } from "@/lib/rules/dnd2024/derive";
import type { Dnd2024Sheet } from "@/lib/rules/dnd2024/sheet/sheet";
import { summarizeClasses, upgradeSheet } from "@/lib/rules/dnd2024/sheet/upgrade";
import { loadSheetEntries } from "@/lib/rules/dnd2024/sheet/sheetEntries";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { Ref } from "@/lib/rules/types";
import { B, buildCatalog, ref } from "../fixtureCatalog";

const COMMON = "language:common|xphb";
const THIEVES = "language:thieves' cant|xphb";
const DRUIDIC = "language:druidic|xphb";

describe("fixedLanguages y languageSlots", () => {
  it("Humano Mago 1: Común y dos de origen", () => {
    expect(fixedLanguages({ wizard: 1 })).toEqual([COMMON]);
    expect(languageSlots({ wizard: 1 })).toEqual([
      { source: "origin", label: "Idiomas de origen", count: 2, standardOnly: true },
    ]);
  });
  it("Pícaro 1: Jerga de ladrones y un hueco más", () => {
    expect(fixedLanguages({ rogue: 1 })).toEqual([COMMON, THIEVES]);
    expect(languageSlots({ rogue: 1 }).map((s) => [s.source, s.count, s.standardOnly]))
      .toEqual([["origin", 2, true], ["rogue", 1, false]]);
  });
  it("Druida 1: Druídico", () => {
    expect(fixedLanguages({ druid: 1 })).toEqual([COMMON, DRUIDIC]);
  });
  it("Explorador: el hueco llega con el nivel 2", () => {
    expect(languageSlots({ ranger: 1 }).map((s) => s.source)).toEqual(["origin"]);
    expect(languageSlots({ ranger: 2 }).map((s) => [s.source, s.label, s.count]))
      .toEqual([["origin", "Idiomas de origen", 2], ["ranger", "Explorador hábil", 2]]);
  });
  it("multiclase Pícaro/Druida: los tres fijos", () => {
    expect(fixedLanguages({ rogue: 1, druid: 1 })).toEqual([COMMON, THIEVES, DRUIDIC]);
  });
});

const lang = (name: string, type: "standard" | "rare"): CatalogEntry => ({
  ref: ref(`language:${name.toLowerCase()}|xphb`), name, nameEs: null, bookName: "Libro", srd52: true, data: { type },
  description: "", descriptionEs: "", identifier: "", parent: null, foundry: null,
});
const langs = new Map<string, CatalogEntry>([
  lang("Common", "standard"), lang("Elvish", "standard"), lang("Dwarvish", "standard"), lang("Giant", "standard"),
  lang("Celestial", "rare"),
].map((e) => [e.ref.key, e]));
langs.get("language:common|xphb")!.nameEs = "Común";
langs.get("language:elvish|xphb")!.nameEs = "Élfico";
langs.get("language:dwarvish|xphb")!.nameEs = "Enano";
const lookup = (r: Ref) => langs.get(r.key) ?? null;
const r = (name: string) => ref(`language:${name}|xphb`);

describe("checkLanguages", () => {
  const slots = languageSlots({ wizard: 1 });
  const fixed = fixedLanguages({ wizard: 1 });
  it("dos estándar → ok", () => {
    expect(checkLanguages([r("elvish"), r("dwarvish")], slots, fixed, lookup)).toBeNull();
  });
  it("uno raro en origen", () => {
    expect(checkLanguages([r("elvish"), r("celestial")], slots, fixed, lookup))
      .toBe("Elige idiomas estándar para tus idiomas de origen.");
  });
  it("Común o repetido", () => {
    expect(checkLanguages([r("elvish"), r("common")], slots, fixed, lookup)).toBe("Ya conoces ese idioma.");
    expect(checkLanguages([r("elvish"), r("elvish")], slots, fixed, lookup)).toBe("Ya conoces ese idioma.");
  });
  it("de menos y de más", () => {
    expect(checkLanguages([r("elvish")], slots, fixed, lookup)).toBe("Faltan idiomas por elegir.");
    expect(checkLanguages([r("elvish"), r("giant"), r("dwarvish")], slots, fixed, lookup))
      .toBe("Has elegido demasiados idiomas.");
  });
  it("el hueco del Pícaro admite un idioma raro", () => {
    const s = languageSlots({ rogue: 1 });
    expect(checkLanguages([r("elvish"), r("dwarvish"), r("celestial")], s, fixedLanguages({ rogue: 1 }), lookup)).toBeNull();
  });
  it("idioma que no existe", () => {
    expect(checkLanguages([r("elvish"), r("zzz")], slots, fixed, lookup)).toBe("Idioma no disponible.");
  });
});

describe("hoja y derive", () => {
  const sheet = (): Dnd2024Sheet => ({
    version: 1,
    species: { ref: ref("species:elf|xphb"), name: "Elfo" },
    lineage: { ref: ref("lineage:drow|xphb"), name: "Drow" },
    background: { ref: ref("background:acolyte|xphb"), name: "Acólito", abilities: { wis: 2, int: 1 }, equipment: "A" },
    classes: [{
      ref: ref("class:barbarian|xphb"), name: "Bárbaro", level: 1, subclass: null, skills: ["athletics", "intimidation"], equipment: "A",
    }],
    abilityMethod: "standard",
    baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    rolls: null,
    speciesChoices: { skills: ["perception"], size: null },
    alignment: "", appearance: "", age: "", languages: "", notes: "", xp: 0,
    hp: { max: null, current: null, temp: 0 },
    languageChoices: [r("elvish"), r("dwarvish")],
  });
  const catalog = () => {
    const c = buildCatalog();
    for (const e of langs.values()) c.set(refKey(e.ref), e);
    return c;
  };

  it("sheetEntries pide los idiomas fijos y los elegidos", async () => {
    const entries = await loadSheetEntries(sheet(), [B], async (refs) =>
      refs.map((x) => catalog().get(refKey(x))).filter((e): e is CatalogEntry => !!e));
    expect([...entries.keys()]).toEqual(expect.arrayContaining([
      refKey(r("common")), refKey(r("elvish")), refKey(r("dwarvish")),
    ]));
  });
  it("Común sale aunque la especie sea de otro libro", async () => {
    const s = sheet();
    s.species = { ref: { book: "otro", key: "species:elf|xphb" }, name: "Elfo" };
    const requested: Ref[] = [];
    const entries = await loadSheetEntries(s, [B, "otro"], async (refs) => {
      requested.push(...refs);
      return refs.map((x) => catalog().get(refKey(x))).filter((e): e is CatalogEntry => !!e);
    });
    expect(requested).toContainEqual(r("common"));
    expect(derive(s, catalog()).languages[0]).toBe("Común");
    expect(entries.has(refKey(r("common")))).toBe(true);
  });
  it("derive: Pícaro/Druida suman Jerga de ladrones y Druídico", () => {
    const c = catalog();
    for (const [n, es] of [["thieves' cant", "Jerga de ladrones"], ["druidic", "Druídico"]] as const) {
      const e = lang(n, "rare");
      e.nameEs = es;
      c.set(refKey(e.ref), e);
    }
    const s = sheet();
    s.classes[0].ref = ref("class:rogue|xphb");
    s.classes[0].name = "Pícaro";
    const rogue = derive(s, c).languages;
    expect(rogue).toEqual(["Común", "Jerga de ladrones", "Élfico", "Enano"]);
    // Pícaro 1 / Druida 1
    const v2 = upgradeSheet(s, c, () => "id");
    v2.levels.push({ ...v2.levels[0], n: 2, class: { ref: ref("class:druid|xphb"), name: "Druida" }, classLevel: 1 });
    v2.classesSummary = summarizeClasses(v2.levels);
    expect(derive(v2, c).languages).toEqual(["Común", "Jerga de ladrones", "Druídico", "Élfico", "Enano"]);
  });
  it("derive: el texto antiguo no repite sin tildes ni mayúsculas", () => {
    const s = sheet();
    s.languages = "comun, ELFICO, Infracomún";
    expect(derive(s, catalog()).languages).toEqual(["Común", "Élfico", "Enano", "Infracomún"]);
  });
  it("upgradeSheet conserva languageChoices", () => {
    expect(upgradeSheet(sheet(), catalog(), () => "id").languageChoices).toEqual([r("elvish"), r("dwarvish")]);
  });
  it("derive: Común, Élfico, Enano, y añade el texto antiguo sin repetir", () => {
    expect(derive(sheet(), catalog()).languages).toEqual(["Común", "Élfico", "Enano"]);
    const s = sheet();
    s.languages = "Élfico, Infracomún";
    expect(derive(s, catalog()).languages).toEqual(["Común", "Élfico", "Enano", "Infracomún"]);
  });
});
