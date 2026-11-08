import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { attackVariants, weaponAttack } from "@/lib/rules/dnd2024/derive/attacks";
import { applyCustom } from "@/lib/rules/dnd2024/sheet/custom";
import { itemActions } from "@/lib/rules/dnd2024/sheet/itemActions";
import type { Dnd2024SheetV2, InventoryItem } from "@/lib/rules/dnd2024/sheet/sheet";
import { applyStatus } from "@/lib/rules/dnd2024/sheet/status";
import { BOOK_PLACEHOLDER, classSpellKeys, inferWeaponMasteries, normalizeAll, normalizeBackground, normalizeFeat, normalizeLanguage, normalizeMonster, relinkRefs } from "@/lib/rules/import/normalize";
import { validateEntryData } from "@/lib/rules/schemas";
import type { BackgroundData, ConditionData, ItemData, MonsterData } from "@/lib/rules/types";

const mods = { str: 0, dex: 3, con: 0, int: 0, wis: 0, cha: 0 };
const weapon = (properties: string[], over: Partial<ItemData> = {}) => ({
  name: "Daga", type: "M", weight: 1, value: 200,
  weapon: { damage: "1d4", damageType: "P", properties, category: "simple", range: "20/60" }, ...over,
}) as ItemData & { name: string };
const variants = (w: ItemData & { name: string }) => attackVariants(weaponAttack(w, mods, 2, true, false), w);

describe("variantes de ataque", () => {
  it("una daga se puede lanzar y usar con la otra mano", () => {
    const rows = variants(weapon(["F", "L", "T"]));
    expect(rows.map((r) => r.variant)).toEqual(["thrown", "offhand"]);
    expect(rows[0]).toMatchObject({ name: "Daga (arrojadiza)", kind: "ranged", bonus: 5, damage: "1d4+3" });
    expect(rows[0].range).not.toContain("1,5 m");
  });

  it("con la otra mano no se suma el modificador positivo, pero sí se conserva uno negativo", () => {
    expect(variants(weapon(["L"]))[0].damage).toBe("1d4");
    const clumsy = { ...mods, str: -1 };
    const w = weapon(["L"]);
    expect(attackVariants(weaponAttack(w, clumsy, 2, true, false), w)[0].damage).toBe("1d4-1");
  });

  it("un arma sin esas propiedades o a distancia no tiene variantes", () => {
    expect(variants(weapon(["V"]))).toEqual([]);
    expect(variants(weapon(["A", "L"], { type: "R" }))).toEqual([]);
  });
});

describe("acciones de los objetos", () => {
  const entry = (key: string, description: string, data: Partial<ItemData> = {}) => ({
    ref: { book: "b", key }, name: key, nameEs: null, description, descriptionEs: "",
    data: { type: "G", weight: 0, value: 0, ...data },
  }) as unknown as CatalogEntry;
  const line = (key: string, quantity = 1) => ({ id: key, ref: { book: "b", key }, name: key, quantity, equipped: false, notes: "" }) as InventoryItem;
  const run = (...es: CatalogEntry[]) => itemActions(es.map((e) => line(e.ref.key)), new Map(es.map((e) => [`b:${e.ref.key}`, e])));

  it("la campana se usa con la acción Utilizar y la yesca con una adicional", () => {
    const rows = run(
      entry("campana", "It is a bell. When rung as a [b]Utilize action[/b], a Bell produces a sound."),
      entry("yesca", "Lighting a torch takes a Bonus Action."),
    );
    expect(rows.map((r) => [r.name, r.group])).toEqual([["Tocar campana", "action"], ["Usar yesca", "bonus"]]);
    expect(rows[0].details).toBe("When rung as a Utilize action, a Bell produces a sound.");
  });

  it("una poción se bebe con una acción adicional y da sus dados de curación", () => {
    const [p] = run(entry("potion", "You regain 2d4 + 2 Hit Points when you drink this potion.", { type: "P" }));
    expect(p).toMatchObject({ name: "Beber potion", group: "bonus", healing: "2d4+2" });
    const [q] = run(entry("Potion of Healing", "As a Bonus Action, you can drink it. The creature that drinks it regains 2d4 + 2 Hit Points.", { type: "P" }));
    expect(q).toMatchObject({ healing: "2d4+2", details: "As a Bonus Action, you can drink it." });
    expect(run(entry("Oil of Sharpness", "One vial of this oil.", { type: "P" }))[0].name).toBe("Aplicar Oil of Sharpness");
  });

  it("sin acción en su texto, o sin unidades, o si es un arma, nada", () => {
    expect(run(entry("cuerda", "A rope."))).toEqual([]);
    expect(run(entry("hacha", "Utilize action.", { weapon: { damage: "1d6", damageType: "S", properties: [], category: "simple" } }))).toEqual([]);
    const e = entry("campana", "A Utilize action.");
    expect(itemActions([line("campana", 0)], new Map([["b:campana", e]]))).toEqual([]);
  });
});

describe("estados propios", () => {
  const sheet = (custom?: Dnd2024SheetV2["custom"]) => ({ custom }) as unknown as Dnd2024SheetV2;
  const ok = (r: ReturnType<typeof applyCustom>) => {
    if (!r.ok) throw new Error(r.error);
    return r.custom;
  };

  it("se crea activo, se desactiva y se borra", () => {
    const a = ok(applyCustom(sheet(), { op: "addCondition", name: "Maldito", description: "Mal de ojo" }, () => "c1"));
    expect(a.conditions).toEqual([{ id: "c1", name: "Maldito", description: "Mal de ojo", active: true }]);
    const b = ok(applyCustom(sheet(a), { op: "conditionActive", id: "c1", active: false }, () => "x"));
    expect(b.conditions[0].active).toBe(false);
    expect(ok(applyCustom(sheet(b), { op: "removeCondition", id: "c1" }, () => "x")).conditions).toEqual([]);
  });

  it("exige nombre y que exista", () => {
    expect(applyCustom(sheet(), { op: "addCondition", name: " " }, () => "x").ok).toBe(false);
    expect(applyCustom(sheet(), { op: "conditionActive", id: "no", active: true }, () => "x").ok).toBe(false);
  });
});

describe("dados de golpe a mano", () => {
  const sheet = { hitDiceUsed: { a: 1 } } as unknown as Dnd2024SheetV2;
  const ctx = { useMax: () => null, hitDiceTotal: (k: string) => (k === "a" ? 3 : null) };

  it("guarda los gastados y, con 0, quita la clave", () => {
    const r = applyStatus(sheet, { op: "hitDice", key: "a", used: 2 }, ctx);
    expect(r.ok && r.sheet.hitDiceUsed).toEqual({ a: 2 });
    const z = applyStatus(sheet, { op: "hitDice", key: "a", used: 0 }, ctx);
    expect(z.ok && z.sheet.hitDiceUsed).toEqual({});
  });

  it("rechaza una clase que no tiene o pasarse del total", () => {
    expect(applyStatus(sheet, { op: "hitDice", key: "b", used: 1 }, ctx).ok).toBe(false);
    expect(applyStatus(sheet, { op: "hitDice", key: "a", used: 4 }, ctx).ok).toBe(false);
  });
});

describe("libros anteriores a 2024", () => {
  it("una dote sin categoría es general", () => {
    const e = normalizeFeat({ name: "Chef", source: "TCE", entries: ["x"] });
    expect(e.data).toMatchObject({ category: "general" });
    expect(validateEntryData("feat", e.data).ok).toBe(true);
  });

  it("una dote con categoría propia de su libro también es general y conserva su código", () => {
    const e = normalizeFeat({ name: "Mark of Making", source: "EFA", category: "D", entries: ["x"] });
    expect(e.data).toMatchObject({ category: "general", categoryCode: "D" });
  });

  it("los idiomas exóticos, secretos o sin tipo son raros", () => {
    for (const type of ["exotic", "secret", undefined]) {
      expect(normalizeLanguage({ name: "Quori", source: "ERLW", type }).data).toEqual({ type: "rare" });
    }
    expect(normalizeLanguage({ name: "Común", source: "ERLW", type: "standard" }).data).toEqual({ type: "standard" });
  });
});

describe("clases y conjuros entre archivos", () => {
  it("una clase puede copiar de otro archivo", () => {
    const files = { classes: [
      { class: [{ name: "Ranger", source: "XPHB", hd: { number: 1, faces: 10 } }] },
      { class: [{ name: "Hunter", source: "WoW", _copy: { name: "Ranger", source: "XPHB" } }] },
    ] };
    expect(normalizeAll(files as never, "WoW").errors.filter((e) => /_copy/.test(e.errors.join()))).toEqual([]);
  });

  it("un conjuro con su lista de clases la conserva", () => {
    const spell = { name: "Hechizo", source: "EGW", level: 1, school: "A", time: [], range: {}, components: {}, duration: [], entries: ["x"], classes: { fromClassList: [{ name: "Wizard", source: "PHB" }] } };
    const { entries } = normalizeAll({ spells: [{ spell: [spell] }] } as never, "EGW");
    expect((entries[0]?.data as { classes: string[] }).classes).toEqual(["wizard"]);
  });

  it("la lista de una clase de homebrew distingue los conjuros con libro de los del Manual", () => {
    expect(classSpellKeys({ name: "Apothecary", classSpells: ["Acid Burn|Guide", "Light"] })).toEqual({
      id: "apothecary", keys: ["spell:acid burn|guide", "spell:light|phb", "spell:light|xphb"],
    });
  });
});

describe("opciones sustituidas por su versión 2024", () => {
  it("una entrada reimpresa queda marcada; las demás no", () => {
    const { entries } = normalizeAll({ languages: { language: [{ name: "Viejo", source: "PHB", type: "standard", reprintedAs: ["Viejo|XPHB"] }, { name: "Otro", source: "PHB", type: "standard" }] } } as never, "PHB");
    expect(entries.map((e) => [e.name, !!e.superseded])).toEqual([["Viejo", true], ["Otro", false]]);
  });

  it("una subclase adaptada cede ante la propia de la clase; sin propia, sigue", () => {
    const sub = (source: string, shortName: string) => ({ name: shortName, shortName, source, className: "Bard", classSource: "XPHB", features: [], subclassFeatures: [] });
    const files = { classes: [{ subclass: [sub("XPHB", "Glamour"), sub("XGE", "Glamour"), sub("XGE", "Swords")] }] };
    const of = (s: string) => normalizeAll(files as never, s).entries.filter((e) => e.kind === "subclass").map((e) => [e.key.split("|").at(-1) === s.toLowerCase() && e.name, !!e.superseded]);
    expect(of("XGE")).toEqual([["Glamour", true], ["Swords", false]]);
    expect(of("XPHB")).toEqual([["Glamour", false]]);
  });
});

describe("referencias a otros libros", () => {
  const data = (key: string) => JSON.stringify({ ref: { book: BOOK_PLACEHOLDER, key } });
  const spell = { book: "xphb", key: "spell:levitate|xphb" };
  const opts = {
    own: new Set(["item:propio|tce"]),
    byKey: (k: string) => (k === "item:rope|xphb" ? { book: "xphb", key: k } : undefined),
    spellByName: (n: string) => (n === "levitate" ? spell : undefined),
  };

  it("un conjuro sin fuente o del Manual de 2014 pasa al del catálogo", () => {
    expect(JSON.parse(relinkRefs(data("spell:levitate"), opts))).toEqual({ ref: spell });
    expect(JSON.parse(relinkRefs(data("spell:levitate|phb"), opts))).toEqual({ ref: spell });
  });

  it("una entrada de otro libro enlaza a ese libro", () => {
    expect(JSON.parse(relinkRefs(data("item:rope|xphb"), opts))).toEqual({ ref: { book: "xphb", key: "item:rope|xphb" } });
  });

  it("deja las del propio libro y las que no encuentra", () => {
    for (const key of ["item:propio|tce", "spell:otro", "item:nada|tce"]) expect(relinkRefs(data(key), opts)).toBe(data(key));
  });
});

describe("subrazas como variantes de la especie", () => {
  const files = {
    races: {
      race: [{ name: "Genasi", source: "MPMM", size: ["M"], speed: 30, entries: [] }, { name: "Humano", source: "MPMM", size: ["M"], speed: 30, entries: [] }],
      subrace: [
        { name: "Air", source: "MPMM", raceName: "Genasi", raceSource: "MPMM", speed: 35, resist: ["lightning"], entries: [{ type: "entries", name: "Viento", entries: ["x"] }] },
        { name: "Otra", source: "MPMM", raceName: "Genasi", raceSource: "EEPC", entries: [] },
      ],
    },
  };

  it("Genasi pasa a tener legados y cada subraza es uno", () => {
    const { entries, errors } = normalizeAll(files as never, "MPMM");
    expect(errors).toEqual([]);
    const genasi = entries.find((e) => e.key === "species:genasi|mpmm")!;
    expect(genasi.data).toMatchObject({ hasLineages: true });
    expect(entries.find((e) => e.key === "species:humano|mpmm")!.data).toMatchObject({ hasLineages: false });
    const air = entries.filter((e) => e.kind === "lineage");
    expect(air.map((e) => e.key)).toEqual(["lineage:genasi (air)|mpmm"]);
    expect(air[0].parent?.key).toBe("species:genasi|mpmm");
    expect(air[0].data).toMatchObject({ speed: 35, traitName: "Viento" });
  });
});

describe("maestrías de una clase de homebrew", () => {
  const raw = { name: "Blood Hunter" };
  const feature = (over: object = {}) => ({ name: "Weapon Mastery", className: "Blood Hunter", level: 1, entries: ["Use the properties of two kinds of weapons of your choice."], ...over });

  it("se deducen del texto del rasgo", () => {
    expect(inferWeaponMasteries(raw, [feature()]).itemMasteriesProgression).toEqual({ 1: 2 });
  });

  it("respeta la que ya trae la clase", () => {
    const own = { ...raw, itemMasteriesProgression: { 1: 3 } };
    expect(inferWeaponMasteries(own, [feature()])).toBe(own);
  });

  it("sin rasgo, de otra clase o sin número no añade nada", () => {
    expect(inferWeaponMasteries(raw, [])).toBe(raw);
    expect(inferWeaponMasteries(raw, [feature({ className: "Otra" })])).toBe(raw);
    expect(inferWeaponMasteries(raw, [feature({ entries: ["Some weapons."] })])).toBe(raw);
  });
});

describe("trasfondos de antes de 2024", () => {
  const raw = {
    name: "Soldier", source: "PHB", entries: [], skillProficiencies: [{ athletics: true }],
    startingEquipment: [{ _: ["clothes|phb", { value: 1000 }] }, { a: ["dagger|phb"], b: ["mace|phb"] }],
  };

  it("permite elegir entre las 6 características, sin dote, y da una opción de equipo", () => {
    const e = normalizeBackground(raw);
    expect(validateEntryData("background", e.data).ok).toBe(true);
    const d = e.data as BackgroundData;
    expect(d.abilities).toHaveLength(6);
    expect(d.feat).toBeNull();
    expect(Object.keys(d.equipment)).toEqual(["A"]);
    expect(d.equipment.A).toHaveLength(3);
  });

  it("uno de 2024 mantiene sus 3 y su dote", () => {
    const e = normalizeBackground({
      name: "Sage", source: "XPHB", entries: [], feats: [{ "magic initiate|xphb": true }],
      ability: [{ choose: { weighted: { from: ["con", "int", "wis"], weights: [2, 1] } } }],
      startingEquipment: [{ A: [{ value: 800 }], B: [{ value: 5000 }] }],
    });
    expect(validateEntryData("background", e.data).ok).toBe(true);
    expect((e.data as BackgroundData).abilities).toEqual(["con", "int", "wis"]);
    expect(Object.keys((e.data as BackgroundData).equipment)).toEqual(["A", "B"]);
  });
});

describe("estados y enfermedades", () => {
  it("se importan con su tipo", () => {
    const { entries } = normalizeAll({ conditions: { condition: [{ name: "Blinded", source: "XPHB", entries: ["x"] }], disease: [{ name: "Cackle Fever", source: "XPHB", entries: ["y"] }] } } as never, "XPHB");
    expect(entries.map((e) => [e.key, (e.data as ConditionData).type])).toEqual([["condition:blinded|xphb", "condition"], ["condition:cackle fever|xphb", "disease"]]);
    for (const e of entries) expect(validateEntryData("condition", e.data).ok).toBe(true);
  });
});

describe("monstruos", () => {
  const raw = {
    name: "Goblin Warrior", source: "XMM", page: 142, size: ["S"], type: { type: "fey", tags: ["goblinoid"] }, alignment: ["C", "N"],
    ac: [{ ac: 15, from: ["leather armor"] }], hp: { average: 10, formula: "3d6" }, speed: { walk: 30, fly: { number: 20, condition: "(hover)" } },
    str: 8, dex: 15, con: 10, int: 10, wis: 8, cha: 8, skill: { stealth: "+6" }, senses: ["Darkvision 60 ft."], passive: 9,
    languages: ["Common"], cr: "1/4", immune: [{ immune: ["poison"], note: "x" }, "fire"], environment: ["forest"],
    action: [{ name: "Scimitar", entries: ["Melee attack."] }], bonus: [{ name: "Nimble Escape", entries: ["Disengage."] }],
  };

  it("normaliza y pasa la validación", () => {
    const e = normalizeMonster(raw);
    expect(e.key).toBe("monster:goblin warrior|xmm");
    expect(validateEntryData("monster", e.data).ok).toBe(true);
    const d = e.data as MonsterData;
    expect(d).toMatchObject({ type: "fey", ac: 15, hp: 10, hpFormula: "3d6", cr: "1/4", abilities: { dex: 15 }, speed: { walk: 30, fly: 20 } });
    expect(d.actions[0].name).toBe("Scimitar");
    expect(d.immune).toEqual(["poison", "fire"]);
  });

  it("los que no tienen estadísticas fijas no rompen", () => {
    const e = normalizeMonster({ name: "Espíritu", source: "TCE", size: ["M"], type: "construct", ac: [{ special: "11 + nivel" }], hp: { special: "40" }, cr: { cr: "1", xp: 200 } });
    expect(validateEntryData("monster", e.data).ok).toBe(true);
    expect(e.data).toMatchObject({ ac: 0, acNote: "11 + nivel", hp: 0, hpFormula: "40", cr: "1" });
  });
});
