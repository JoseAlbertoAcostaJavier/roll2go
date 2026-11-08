import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { Derived } from "@/lib/rules/dnd2024/derive";
import { sheetPdfValues, twoColumns, type PdfInput } from "@/lib/rules/dnd2024/sheet/pdfValues";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import { fillSheetPdf, pdfFieldNames, pdfSafe } from "@/lib/server/characters/sheetPdf";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
const SKILLS = ["acrobatics", "animal handling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight of hand", "stealth", "survival"];
const many = <T,>(n: number, make: (i: number) => T) => Array.from({ length: n }, (_, i) => make(i));
const ref = { book: "b", key: "feat:alert|xphb" };
const spellRef = (i: number) => ({ book: "b", key: `spell:s${String(i).padStart(2, "0")}|xphb` });
const entries = new Map<string, CatalogEntry>(many(32, (i) => [`b:spell:s${String(i).padStart(2, "0")}|xphb`, {
  ref: spellRef(i), name: `Conjuro ${String(i).padStart(2, "0")}`, nameEs: null, description: "", descriptionEs: "",
  data: { level: 1, time: "1 acción", range: "9 m", components: "V, S, M", concentration: i === 0, ritual: i === 0 },
} as unknown as CatalogEntry]));

// Un personaje que llena todos los huecos con límite de la plantilla
const input = (over: Partial<Dnd2024SheetV2> = {}, derived: Partial<Derived> = {}): PdfInput => ({
  name: "Ana", backstory: "Historia",
  sheet: {
    background: { name: "Sabio" }, species: { name: "Genasi" }, lineage: { name: "Genasi (Fuego)" }, xp: 300, speciesChoices: { skills: [], size: "M" },
    alignment: "neutral", age: "30", appearance: "Alta", notes: "Nota", personality: "P", ideals: "I", bonds: "B", flaws: "F", organizations: "O", allies: "A", enemies: "E",
    heroicInspiration: true, conditions: ["poisoned"], exhaustion: 1,
    inventory: { items: many(5, (i) => ({ id: `i${i}`, ref: null, name: `Objeto ${i}`, quantity: i + 1, equipped: i === 0, notes: "", attuned: i < 4 })), coins: { cp: 1, sp: 2, ep: 3, gp: 4, pp: 5 }, other: "Casa" },
    ...over,
  } as unknown as Dnd2024SheetV2,
  derived: {
    level: 3, classes: [{ name: "Mago", level: 3, subclass: "Evocador", ref }], proficiencyBonus: 2,
    abilities: Object.fromEntries(ABILITIES.map((a) => [a, { score: 14, mod: 2 }])),
    saves: ABILITIES.map((ability) => ({ ability, proficient: true, total: 4 })),
    skills: SKILLS.map((id) => ({ id, proficiency: 2, total: 6 })),
    hp: { max: 20, current: 15, temp: 3 }, ac: 13, initiative: 2, speed: 30, darkvision: 60, armor: ["light", "medium", "heavy", "shield"], weapons: ["simple", "martial"],
    tools: ["Herramienta"], languages: ["Común", "Élfico"],
    defenses: [{ kind: "resist", type: "fire", sources: [] }],
    attacks: many(7, (i) => ({ name: `Arma ${i}`, bonus: 4, damage: "1d6 / 1d8 (dos manos)", damageType: "cortante", notes: "x", range: "1,5 m", kind: "melee" })),
    weight: { total: 10, capacity: 100, over: false },
    features: [
      { title: "Mago", source: "class", ref, features: [{ ref, name: "Conjuros", level: 1 }] },
      { title: "Genasi", source: "species", ref, features: [{ ref, name: "Fuego", level: 1 }] },
      { title: "Dotes", source: "feat", ref: null, features: [{ ref, name: "Alerta", level: 1 }] },
    ],
    featureUses: [{ key: "u", name: "Uso", max: 2, used: 1, recovery: { long: "all", short: "none" } }],
    hasSpells: true,
    spells: {
      blocks: [
        { name: "Mago", ability: "int", dc: 13, attack: 5, cantrips: [], prepared: many(32, spellRef), always: [] },
        { name: "Clérigo", ability: "wis", dc: 12, attack: 4, cantrips: [], prepared: [], always: [] },
      ],
      slots: { levels: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }, pact: null }, other: [], used: { 1: 2 }, limitedUsed: {},
    },
    ...derived,
  } as unknown as Derived,
  entries,
  pools: [{ classKey: "c", name: "Mago", die: 6, total: 3, used: 1 }],
  actions: [{ kind: "feature", group: "action", ref, name: "Rasgo", source: "x", special: false } as never],
  itemActions: [],
});

describe("valores de la ficha en PDF", () => {
  const values = sheetPdfValues(input());

  it("todos los campos que escribe existen en la plantilla", { timeout: 30000 }, async () => {
    const names = await pdfFieldNames();
    expect([...Object.keys(values.text), ...values.checked, ...Object.keys(values.sizes)].filter((n) => !names.has(n))).toEqual([]);
  });

  it("rellena cabecera y combate", () => {
    expect(values.text).toMatchObject({ Text1: "Ana", Text7: "Mago 3", Text8: "Genasi (Fuego)", Text9: "Evocador", Text13: "13", Text14: "15", Text16: "20", Text17: "3d6", Text18: "1", Text29: "16", Text100: "Neutral" });
  });

  it("escribe cada característica en sus campos", () => {
    expect(values.text).toMatchObject({ Text21: "+2", Text64: "14", Text91: "+4", Text92: "+6", Text85: "+6" });
    expect(values.checked).toEqual(expect.arrayContaining(["Check Box37", "Check Box38", "Check Box29", "Check Box11", "Check Box12"]));
  });

  it("une los lanzadores y marca los espacios gastados", () => {
    expect(values.text).toMatchObject({ Text93: "+2/+2", Text94: "13/12", Text112: "4" });
    expect(values.checked).toEqual(expect.arrayContaining(["Check Box227", "Check Box228"]));
    expect(values.checked).not.toContain("Check Box229");
  });

  it("llena las 30 filas de conjuros y avisa de los que no caben", () => {
    expect(values.text["Text106.0"]).toBe("Conjuro 00");
    expect(values.text["Text106.29"]).toBe("Conjuro 29");
    expect(values.text.Text236).toBe("+3 más");
    expect(values.checked).toEqual(expect.arrayContaining(["Check Box252.0", "Check Box253.0", "Check Box254.0.0", "Check Box260.9"]));
  });

  it("solo usa las 6 filas de ataques y los 3 huecos de sintonización", () => {
    expect(values.text.Text50).toBe("Arma 5");
    expect(Object.values(values.text)).not.toContain("Arma 6");
    expect(values.text.Text103).toBe("Objeto 2");
    expect(values.checked).toContain("Check Box251");
  });

  it("un personaje sin conjuros ni opcionales no rompe", () => {
    const v = sheetPdfValues(input({ lineage: null, conditions: undefined, exhaustion: 0 }, { spells: { blocks: [], slots: { levels: {}, pact: null }, other: [], used: {}, limitedUsed: {} } as never }));
    expect(v.text.Text8).toBe("Genasi");
    expect(v.text.Text111).toBeUndefined();
  });

  it("reparte los bloques en dos columnas sin partirlos", () => {
    expect(twoColumns(["a\nb", "c\nd", "e"])).toEqual(["a\nb\n\nc\nd", "e"]);
    expect(twoColumns([])).toEqual(["", ""]);
  });
});

describe("PDF generado", () => {
  it("sigue siendo editable y lleva los datos en sus campos", { timeout: 30000 }, async () => {
    const doc = await PDFDocument.load(await fillSheetPdf(sheetPdfValues(input())));
    expect(doc.getPageCount()).toBe(2);
    const form = doc.getForm();
    expect(form.getFields().length).toBe((await pdfFieldNames()).size);
    expect(form.getTextField("Text1").getText()).toBe("Ana");
    expect(form.getTextField("Text1").isReadOnly()).toBe(false);
    expect(form.getCheckBox("Check Box11").isChecked()).toBe(true);
    expect(form.getCheckBox("Check Box229").isChecked()).toBe(false);
  });

  it("no falla con caracteres que la fuente no admite", () => {
    expect(pdfSafe("1 → 2 ✦ Añejo €")).toBe("1 -> 2  Añejo €");
  });
});
