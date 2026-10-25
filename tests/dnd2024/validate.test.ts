import { beforeAll, describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { checkChoices, validateSheet } from "@/lib/rules/dnd2024/validate";
import { signRolls } from "@/lib/rules/dnd2024/rolls";
import type { Ref } from "@/lib/rules/types";
import { B as FB, buildCatalog, ref as fref } from "./fixtureCatalog";

beforeAll(() => {
  process.env.AUTH_SECRET = "secreto-de-prueba";
});

type Sheet = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const B = "b1";
const entry = (key: string, data: unknown, extra: Partial<CatalogEntry> = {}): CatalogEntry => ({
  ref: { book: B, key }, name: key, nameEs: null, bookName: "Libro", srd52: true, data,
  description: "", descriptionEs: "", identifier: "", parent: null, foundry: null, ...extra,
});
const catalog = new Map<string, CatalogEntry>(
  [
    entry("item:longsword|xphb", { weapon: { category: "martial" } }, { name: "Longsword", nameEs: "Espada larga" }),
    entry("species:elf|xphb", { size: ["M"], hasLineages: true, skills: { fixed: [] } }, { name: "Elf", nameEs: "Elfo" }),
    entry("species:dwarf|xphb", {
      size: ["M"], hasLineages: false, skills: { fixed: ["Perception"] },
    }),
    // Tiene legados, pero ninguno en los libros utilizables
    entry("species:gnome|xphb", { size: ["S"], hasLineages: true, skills: { fixed: [] } }),
    entry("species:human|xphb", {
      size: ["M", "S"], hasLineages: false, skills: { fixed: [], choose: { count: 1, from: ["Perception", "Insight"] } },
    }),
    entry("lineage:drow|xphb", {}, { parent: { book: B, key: "species:elf|xphb" } }),
    entry("lineage:other|xphb", {}, { parent: { book: B, key: "species:dwarf|xphb" } }),
    entry("background:acolyte|xphb", {
      abilities: ["int", "wis", "cha"], skills: ["Insight", "Religion"], equipment: { A: [], B: [] },
    }),
    entry("class:fighter|xphb", {
      skills: { count: 2, from: ["Acrobatics", "Athletics", "Insight", "Perception"] },
      equipment: { A: [{ ref: { book: B, key: "item:longsword|xphb" } }], B: [], C: [{ value: 15500 }] },
      subclassLevel: 3, hitDie: 10, features: [],
      progressions: { feats: [], optionalFeatures: [], weaponMastery: null, cantrips: null, prepared: null, spellbook: null },
    }, { name: "Fighter", nameEs: "Guerrero" }),
  ].map((e) => [e.ref.key, e]),
);
const ctx = {
  userId: "u1",
  books: [B],
  resolve: async (r: Ref) => (r.book === B ? (catalog.get(r.key) ?? null) : null),
  hasLineages: async (species: Ref) =>
    [...catalog.values()].some((e) => e.ref.key.startsWith("lineage:") && e.parent?.key === species.key && e.parent.book === species.book),
  makeId: () => "id1",
};
const named = (key: string, book = B) => ({ ref: { book, key }, name: "cliente" });

const valid = (): Sheet => ({
  version: 1,
  species: named("species:elf|xphb"),
  lineage: named("lineage:drow|xphb"),
  background: { ...named("background:acolyte|xphb"), abilities: { int: 2, wis: 1 }, equipment: "A" },
  classes: [{
    ...named("class:fighter|xphb"), level: 1, subclass: null, equipment: "C",
    choices: [{ type: "skills", source: "class:skills", value: ["Athletics", "Acrobatics"] }],
  }],
  abilityMethod: "standard",
  baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  rolls: null,
  speciesChoices: { skills: [], size: null },
  alignment: "Neutral", appearance: "", age: "", languages: "", notes: "", xp: 0,
  hp: { max: null, current: null, temp: 0 },
});
const run = (mut: (s: Sheet) => void) => {
  const s = valid();
  mut(s);
  return validateSheet(s, ctx);
};
const errorsOf = async (mut: (s: Sheet) => void) => {
  const r = await run(mut);
  return r.ok ? {} : r.errors;
};

describe("validateSheet", () => {
  it("acepta una hoja válida y toma los nombres del catálogo", async () => {
    const r = await run(() => {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sheet.species.name).toBe("Elfo");
    expect(r.sheet.lineage?.name).toBe("lineage:drow|xphb");
  });
  it("devuelve la hoja v2: nivel 1 en el historial y el equipo en el inventario", async () => {
    const r = await run(() => {});
    if (!r.ok) throw new Error("hoja no válida");
    expect(r.sheet.version).toBe(2);
    expect(r.sheet).not.toHaveProperty("classes");
    expect(r.sheet.classesSummary).toEqual([
      { class: { ref: { book: B, key: "class:fighter|xphb" }, name: "Guerrero" }, level: 1, subclass: null },
    ]);
    expect(r.sheet.levels[0]).toMatchObject({
      n: 1, classLevel: 1, hp: { method: "max", value: 10 }, equipment: "C",
      choices: [{ type: "skills", source: "class:skills", value: ["Athletics", "Acrobatics"] }],
    });
    expect(r.sheet.inventory).toEqual({ items: [], coins: { cp: 0, sp: 0, ep: 0, gp: 155, pp: 0 }, other: "" });
  });
  it("vuelca los objetos del equipo elegido, cargados del catálogo", async () => {
    const r = await run((s) => { s.classes[0].equipment = "A"; });
    if (!r.ok) throw new Error("hoja no válida");
    expect(r.sheet.inventory.items).toEqual([{
      id: "id1", ref: { book: B, key: "item:longsword|xphb" }, name: "Espada larga", quantity: 1, equipped: true, notes: "",
    }]);
  });
  it("rechaza lo que no es un objeto", async () => {
    expect((await validateSheet(null, ctx)).ok).toBe(false);
  });
  it("legados", async () => {
    expect(await errorsOf((s) => {
      s.species = named("species:human|xphb");
      s.speciesChoices = { skills: ["Insight"], size: "M" };
    })).toHaveProperty("lineage");
    expect(await errorsOf((s) => { s.lineage = named("lineage:other|xphb"); })).toHaveProperty("lineage");
    expect(await errorsOf((s) => { s.lineage = null; })).toHaveProperty("lineage");
  });
  it("sin legados en los libros utilizables no se exige legado", async () => {
    const r = await run((s) => { s.species = named("species:gnome|xphb"); s.lineage = null; });
    expect(r.ok).toBe(true);
  });
  it("referencias fuera de books, inexistentes o de otro tipo", async () => {
    expect(await errorsOf((s) => { s.species = named("species:elf|xphb", "otro"); })).toHaveProperty("species");
    expect(await errorsOf((s) => { s.species = named("species:nope|xphb"); })).toHaveProperty("species");
    expect(await errorsOf((s) => { s.species = named("class:fighter|xphb"); })).toHaveProperty("species");
  });
  it("elección de habilidades y tamaño de especie", async () => {
    const human = (s: Sheet) => { s.species = named("species:human|xphb"); s.lineage = null; };
    expect(await errorsOf((s) => { human(s); })).toHaveProperty("speciesChoices.skills");
    expect(await errorsOf((s) => { human(s); s.speciesChoices.skills = ["Stealth"]; }))
      .toHaveProperty("speciesChoices.skills");
    expect(await errorsOf((s) => { human(s); s.speciesChoices = { skills: ["Perception"], size: null }; }))
      .toHaveProperty("speciesChoices.size");
    expect((await run((s) => { human(s); s.speciesChoices = { skills: ["Perception"], size: "S" }; })).ok).toBe(true);
    expect(await errorsOf((s) => { s.speciesChoices.skills = ["Insight"]; })).toHaveProperty("speciesChoices.skills");
  });
  it("trasfondo: bonificación, total y equipo", async () => {
    expect(await errorsOf((s) => { s.background.abilities = { str: 2, wis: 1 }; })).toHaveProperty("background.abilities");
    expect(await errorsOf((s) => { s.background.abilities = { int: 3 }; })).toHaveProperty("background.abilities");
    expect(await errorsOf((s) => {
      s.abilityMethod = "manual";
      s.baseAbilities = { str: 10, dex: 10, con: 10, int: 19, wis: 10, cha: 10 };
    })).toHaveProperty("background.abilities");
    expect(await errorsOf((s) => { s.background.equipment = "C"; })).toHaveProperty("background.equipment");
  });
  it("habilidades y equipo de clase", async () => {
    // repite una del trasfondo
    expect(await errorsOf((s) => { s.classes[0].choices[0].value = ["Athletics", "Insight"]; })).toHaveProperty(["levels.0.choices.class:skills"]);
    expect(await errorsOf((s) => { s.classes[0].choices[0].value = ["Athletics"]; })).toHaveProperty(["levels.0.choices.class:skills"]);
    expect(await errorsOf((s) => { s.classes[0].choices[0].value = ["Athletics", "Athletics"]; })).toHaveProperty(["levels.0.choices.class:skills"]);
    expect(await errorsOf((s) => { s.classes[0].choices[0].value = ["Athletics", "Stealth"]; })).toHaveProperty(["levels.0.choices.class:skills"]);
    expect(await errorsOf((s) => { s.classes[0].equipment = "D"; })).toHaveProperty("classes.0.equipment");
  });
  it("las habilidades de clase no repiten las de la especie (fijas o elegidas)", async () => {
    const human = (s: Sheet) => {
      s.species = named("species:human|xphb");
      s.lineage = null;
      s.speciesChoices = { skills: ["Perception"], size: "M" };
    };
    expect(await errorsOf((s) => { human(s); s.classes[0].choices[0].value = ["Athletics", "Perception"]; }))
      .toHaveProperty(["levels.0.choices.class:skills"]);
    expect((await run((s) => { human(s); })).ok).toBe(true);
    const dwarf = (s: Sheet) => { s.species = named("species:dwarf|xphb"); s.lineage = null; };
    expect((await run(dwarf)).ok).toBe(true);
    expect(await errorsOf((s) => { dwarf(s); s.classes[0].choices[0].value = ["Athletics", "Perception"]; }))
      .toHaveProperty(["levels.0.choices.class:skills"]);
  });
  it("la habilidad elegida de especie no repite una del trasfondo", async () => {
    expect(await errorsOf((s) => {
      s.species = named("species:human|xphb");
      s.lineage = null;
      s.speciesChoices = { skills: ["Insight"], size: "M" };
    })).toHaveProperty("speciesChoices.skills");
  });
  it("al crear, los PG deben llegar vacíos", async () => {
    expect((await run((s) => { delete s.hp; })).ok).toBe(true);
    expect(await errorsOf((s) => { s.hp = { max: 10, current: null, temp: 0 }; })).toHaveProperty("hp");
    expect(await errorsOf((s) => { s.hp = { max: null, current: 5, temp: 0 }; })).toHaveProperty("hp");
    expect(await errorsOf((s) => { s.hp = { max: null, current: null, temp: 3 }; })).toHaveProperty("hp");
    expect(await errorsOf((s) => { s.hp = "x"; })).toHaveProperty("hp");
  });
  it("métodos de características", async () => {
    expect(await errorsOf((s) => { s.baseAbilities.str = 14; })).toHaveProperty("baseAbilities");
    const pb = (v: number[]) => (s: Sheet) => {
      s.abilityMethod = "pointBuy";
      s.baseAbilities = { str: v[0], dex: v[1], con: v[2], int: v[3], wis: v[4], cha: v[5] };
    };
    expect((await run(pb([15, 15, 15, 8, 8, 8]))).ok).toBe(true);
    expect(await errorsOf(pb([15, 15, 15, 9, 8, 8]))).toHaveProperty("baseAbilities");
    expect(await errorsOf(pb([16, 8, 8, 8, 8, 8]))).toHaveProperty("baseAbilities");
    expect(await errorsOf(pb([7, 8, 8, 8, 8, 8]))).toHaveProperty("baseAbilities");
    const manual = (n: number) => (s: Sheet) => { s.abilityMethod = "manual"; s.baseAbilities.str = n; };
    expect((await run(manual(20))).ok).toBe(true);
    expect(await errorsOf(manual(21))).toHaveProperty("baseAbilities");
    expect(await errorsOf(manual(2))).toHaveProperty("baseAbilities");
  });
  it("tiradas firmadas", async () => {
    const values = [15, 14, 13, 12, 10, 8];
    const roll = (token: string, vals = values) => (s: Sheet) => {
      s.abilityMethod = "roll";
      s.rolls = { values: vals, token };
    };
    const r = await run(roll(signRolls("u1", values)));
    expect(r.ok && r.sheet.rolls?.values).toEqual(values);
    expect(await errorsOf(roll("x.y"))).toHaveProperty("rolls");
    expect(await errorsOf(roll(signRolls("u2", values)))).toHaveProperty("rolls");
    expect(await errorsOf(roll(signRolls("u1", values, Date.now() - 25 * 3600 * 1000)))).toHaveProperty("rolls");
    // el reparto no usa las tiradas firmadas
    const other = [15, 14, 13, 12, 10, 9];
    expect(await errorsOf(roll(signRolls("u1", other), other))).toHaveProperty("baseAbilities");
    expect(await errorsOf((s) => { s.abilityMethod = "roll"; s.rolls = null; })).toHaveProperty("rolls");
  });
  it("al rehacer, acepta las tiradas que ya tenía el personaje aunque hayan caducado", async () => {
    const values = [15, 14, 13, 12, 10, 8];
    const old = signRolls("u1", values, Date.now() - 25 * 3600 * 1000);
    const s = valid();
    s.abilityMethod = "roll";
    s.rolls = { values, token: old };
    const r = await validateSheet(s, { ...ctx, keptRolls: { values: [...values].reverse(), token: old } });
    expect(r.ok && r.sheet.rolls?.values).toEqual(values);
    // Otro token u otros valores con el mismo token no valen
    expect((await validateSheet(s, { ...ctx, keptRolls: { values, token: "1.otro" } })).ok).toBe(false);
    s.rolls = { values: [18, 14, 13, 12, 10, 8], token: old };
    s.baseAbilities = { ...s.baseAbilities, str: 18 };
    expect((await validateSheet(s, { ...ctx, keptRolls: { values, token: old } })).ok).toBe(false);
  });
  it("textos y experiencia", async () => {
    expect(await errorsOf((s) => { s.alignment = "x".repeat(41); })).toHaveProperty("alignment");
    expect(await errorsOf((s) => { s.notes = "x".repeat(10001); })).toHaveProperty("notes");
    expect(await errorsOf((s) => { s.xp = 355001; })).toHaveProperty("xp");
    expect(await errorsOf((s) => { s.xp = 1.5; })).toHaveProperty("xp");
    const r = await run((s) => { s.notes = "a\u0000b"; });
    expect(r.ok && r.sheet.notes).toBe("ab");
  });
});

describe("validateSheet: elecciones de clase de nivel 1", () => {
  const cat = buildCatalog([
    "class-barbarian.json", "class-cleric.json", "class-druid.json", "class-fighter.json", "class-rogue.json", "class-wizard.json",
  ]);
  // Armas y un estilo de combate que no están en los fixtures
  const extra = (key: string, data: unknown, name: string) =>
    cat.set(`${FB}:${key}`, { ...cat.get(`${FB}:item:greataxe|xphb`)!, ref: fref(key), name, nameEs: null, data });
  extra("item:longbow|xphb", {
    type: "R", weight: 2, value: 5000,
    weapon: { damage: "1d8", damageType: "P", properties: ["A", "H", "2H"], mastery: "slow", category: "martial" },
  }, "Longbow");
  extra("item:shortsword|xphb", {
    type: "M", weight: 2, value: 1000,
    weapon: { damage: "1d6", damageType: "P", properties: ["F", "L"], mastery: "vex", category: "martial" },
  }, "Shortsword");
  extra("feat:archery|xphb", { category: "fightingStyle", repeatable: false }, "Archery");
  const WIZARD_SPELLS = ["magic missile", "shield", "sleep", "mage armor", "detect magic", "burning hands", "grease"];
  for (const [name, level, classes] of [
    ["light", 0, ["cleric", "wizard"]], ["sacred flame", 0, ["cleric"]], ["guidance", 0, ["cleric", "druid"]],
    ["thaumaturgy", 0, ["cleric"]], ["spare the dying", 0, ["cleric"]], ["toll the dead", 0, ["cleric"]],
    ["druidcraft", 0, ["druid"]], ["produce flame", 0, ["druid"]],
    ["dancing lights", 0, ["wizard"]], ["sanctuary", 1, ["cleric"]],
    ["mage hand", 0, ["wizard"]], ["fire bolt", 0, ["wizard"]], ["fireball", 3, ["wizard"]],
    ...WIZARD_SPELLS.map((n) => [n, 1, ["wizard"]]),
  ] as [string, number, string[]][]) {
    extra(`spell:${name}|xphb`, {
      level, school: "V", time: "", range: "", components: "", duration: "", concentration: false, ritual: false, classes, tags: [],
    }, name);
  }
  const spellChoice = (cls: string, cantrips: string[], spells: string[] = []) => ({
    type: "spells", source: `progression:spells|${cls}|xphb`,
    value: { cantrips: cantrips.map((n) => fnamed(`spell:${n}|xphb`)), spells: spells.map((n) => fnamed(`spell:${n}|xphb`)) },
  });
  const CLERIC_CANTRIPS = ["light", "sacred flame", "guidance"];
  const fctx = {
    userId: "u1",
    books: [FB],
    resolve: async (r: Ref) => (r.book === FB ? (cat.get(`${FB}:${r.key}`) ?? null) : null),
    hasLineages: async () => true,
    makeId: () => "id1",
  };
  const fnamed = (key: string) => ({ ref: fref(key), name: "cliente" });
  const skills = (value: string[]) => ({ type: "skills", source: "class:skills", value });
  // Conjuros de Iniciado en la magia (Clérigo), la dote del Acólito; se añaden si la prueba no trae los suyos
  const INITIATE = "featSpells:feat:magic initiate; cleric|xphb";
  const initiateSpells = (cantrips: string[], spells: string[], ability?: string) => ({
    type: "featSpells", source: INITIATE, value: {
      cantrips: cantrips.map((n) => fnamed(`spell:${n}|xphb`)), spells: spells.map((n) => fnamed(`spell:${n}|xphb`)),
      ...(ability ? { ability } : {}),
    },
  });
  const sheetFor = (cls: string, choices: unknown[]): Sheet => ({
    version: 1,
    species: fnamed("species:elf|xphb"),
    lineage: fnamed("lineage:drow|xphb"),
    background: { ...fnamed("background:acolyte|xphb"), abilities: { wis: 2, int: 1 }, equipment: "A" },
    classes: [{
      ...fnamed(`class:${cls}|xphb`), level: 1, subclass: null, equipment: "A",
      choices: choices.some((c) => (c as { type?: string }).type === "featSpells")
        ? choices : [...choices, initiateSpells(["spare the dying", "toll the dead"], ["sanctuary"], "wis")],
    }],
    abilityMethod: "standard",
    baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    rolls: null,
    speciesChoices: { skills: ["perception"], size: null },
    alignment: "", appearance: "", age: "", languages: "", notes: "", xp: 0,
    hp: { max: null, current: null, temp: 0 },
  });
  const order = (key: string) => ({ type: "featureOption", source: "classFeature:divine order|cleric|xphb|1", value: fnamed(key) });
  const errs = (r: Awaited<ReturnType<typeof validateSheet>>) => (r.ok ? {} : r.errors);
  const choiceErrors = (r: Awaited<ReturnType<typeof validateSheet>>) =>
    Object.keys(errs(r)).filter((k) => k.startsWith("levels.0.choices"));

  it("Clérigo 1 sin Orden divina → error en levels.0.choices", async () => {
    const r = await validateSheet(sheetFor("cleric", [skills(["history", "medicine"])]), fctx);
    expect(errs(r)).toHaveProperty("levels.0.choices");
  });
  it("Clérigo 1 con Orden divina → ok, con el nombre del catálogo", async () => {
    const r = await validateSheet(sheetFor("cleric", [
      skills(["history", "medicine"]), order("classFeature:protector|cleric|xphb|1"), spellChoice("cleric", CLERIC_CANTRIPS),
    ]), fctx);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.sheet.levels[0].choices.slice(0, 2)).toEqual([
      { type: "skills", source: "class:skills", value: ["history", "medicine"] },
      { type: "featureOption", source: "classFeature:divine order|cleric|xphb|1", value: { ref: fref("classFeature:protector|cleric|xphb|1"), name: "Protector" } },
    ]);
    expect(r.sheet.weaponMasteries).toEqual([]);
  });
  it("Clérigo 1: exige sus 3 trucos de la lista del Clérigo", async () => {
    const base = [skills(["history", "medicine"]), order("classFeature:protector|cleric|xphb|1")];
    expect(errs(await validateSheet(sheetFor("cleric", base), fctx))["levels.0.choices"]).toMatch(/Conjuros/);
    expect(errs(await validateSheet(sheetFor("cleric", [...base, spellChoice("cleric", ["light", "guidance"])]), fctx)))
      .toHaveProperty(["levels.0.choices.progression:spells|cleric|xphb"], "Conjuros: elige 3 trucos.");
    expect(errs(await validateSheet(sheetFor("cleric", [...base, spellChoice("cleric", ["light", "guidance", "fire bolt"])]), fctx)))
      .toHaveProperty(["levels.0.choices.progression:spells|cleric|xphb"], "Conjuros: fire bolt no está en la lista de la clase.");
  });
  it("Clérigo 1 Taumaturgo: un truco más (4); Protector, 3", async () => {
    const SOURCE = "levels.0.choices.progression:spells|cleric|xphb";
    const thaumaturge = [skills(["history", "medicine"]), order("classFeature:thaumaturge|cleric|xphb|1")];
    expect(errs(await validateSheet(sheetFor("cleric", [...thaumaturge, spellChoice("cleric", CLERIC_CANTRIPS)]), fctx)))
      .toHaveProperty([SOURCE], "Conjuros: elige 4 trucos.");
    const r = await validateSheet(sheetFor("cleric", [...thaumaturge, spellChoice("cleric", [...CLERIC_CANTRIPS, "thaumaturgy"])]), fctx);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const protector = [skills(["history", "medicine"]), order("classFeature:protector|cleric|xphb|1")];
    expect(errs(await validateSheet(sheetFor("cleric", [...protector, spellChoice("cleric", [...CLERIC_CANTRIPS, "thaumaturgy"])]), fctx)))
      .toHaveProperty([SOURCE], "Conjuros: elige 3 trucos.");
  });
  describe("Acólito → Iniciado en la magia (Clérigo)", () => {
    const CLERIC = () => [skills(["history", "medicine"]), order("classFeature:protector|cleric|xphb|1"), spellChoice("cleric", CLERIC_CANTRIPS)];
    const fighter = (spells: unknown) => validateSheet(sheetFor("cleric", [...CLERIC(), spells]), fctx);
    it("exige 2 trucos y 1 conjuro de nivel 1 de la lista del Clérigo y la característica", async () => {
      const r = await fighter(initiateSpells(["spare the dying", "toll the dead"], ["sanctuary"], "wis"));
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.sheet.levels[0].choices.at(-1)).toEqual({
        type: "featSpells", source: INITIATE, value: {
          feat: fref("feat:magic initiate; cleric|xphb"),
          cantrips: [
            { ref: fref("spell:spare the dying|xphb"), name: "spare the dying" }, { ref: fref("spell:toll the dead|xphb"), name: "toll the dead" },
          ],
          spells: [{ ref: fref("spell:sanctuary|xphb"), name: "sanctuary" }], ability: "wis",
        },
      });
    });
    it("uno de la lista del Mago, de otro nivel, en número distinto o sin característica → error", async () => {
      const PATH = `levels.0.choices.${INITIATE}`;
      expect(errs(await fighter(initiateSpells(["light", "mage hand"], ["sanctuary"], "wis"))))
        .toHaveProperty([PATH], "Conjuros de Magic Initiate; Cleric: mage hand no se puede elegir con esta dote.");
      expect(errs(await fighter(initiateSpells(["light", "guidance"], ["magic missile"], "wis")))).toHaveProperty([PATH]);
      expect(errs(await fighter(initiateSpells(["light"], ["sanctuary"], "wis"))))
        .toHaveProperty([PATH], "Conjuros de Magic Initiate; Cleric: elige 2 trucos.");
      expect(errs(await fighter(initiateSpells(["light", "guidance"], ["sanctuary"]))))
        .toHaveProperty([PATH], "Conjuros de Magic Initiate; Cleric: elige la característica de lanzamiento.");
    });
    it("el mismo truco elegido por la clase y por la dote → error en la elección de la dote", async () => {
      expect(errs(await fighter(initiateSpells(["light", "toll the dead"], ["sanctuary"], "wis"))))
        .toHaveProperty([`levels.0.choices.${INITIATE}`], "Conjuros de Magic Initiate; Cleric: light ya lo eliges con la clase.");
    });
    it("sin elegirlos → falta", async () => {
      const r = await validateSheet(sheetFor("cleric", [...CLERIC(), { type: "featSpells", source: "x" }]), fctx);
      expect(errs(r)["levels.0.choices"]).toBe("Hay elecciones que este nivel no pide.");
      const sheet = sheetFor("cleric", CLERIC());
      sheet.classes[0].choices = (sheet.classes[0].choices as { type: string }[]).filter((c) => c.type !== "featSpells");
      expect(errs(await validateSheet(sheet, fctx))["levels.0.choices"]).toBe("Falta elegir: Conjuros de Magic Initiate; Cleric.");
    });
  });
  it("un truco que ya da el legado (Drow → Luces danzantes) no se puede elegir", async () => {
    const r = await validateSheet(sheetFor("wizard", [
      skills(["arcana", "history"]), spellChoice("wizard", ["light", "mage hand", "dancing lights"], WIZARD_SPELLS.slice(0, 6)),
    ]), fctx);
    expect(errs(r)).toHaveProperty(["levels.0.choices.progression:spells|wizard|xphb"], "Conjuros: ya tienes dancing lights.");
  });
  it("Druida 1 Mago (Orden primigenia): un truco más (3)", async () => {
    const SOURCE = "levels.0.choices.progression:spells|druid|xphb";
    const druid = (option: string, cantrips: string[]) => validateSheet(sheetFor("druid", [
      skills(["arcana", "nature"]),
      { type: "featureOption", source: "classFeature:primal order|druid|xphb|1", value: fnamed(option) },
      spellChoice("druid", cantrips),
    ]), fctx);
    expect(errs(await druid("classFeature:magician|druid|xphb|1", ["guidance", "druidcraft"])))
      .toHaveProperty([SOURCE], "Conjuros: elige 3 trucos.");
    const r = await druid("classFeature:magician|druid|xphb|1", ["guidance", "druidcraft", "produce flame"]);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const warden = await druid("classFeature:warden|druid|xphb|1", ["guidance", "druidcraft"]);
    if (!warden.ok) throw new Error(JSON.stringify(warden.errors));
  });
  it("Mago 1: exige sus trucos y el libro inicial de 6 conjuros de nivel 1", async () => {
    const SOURCE = "levels.0.choices.progression:spells|wizard|xphb";
    const wizard = (choice: unknown) => validateSheet(sheetFor("wizard", [skills(["arcana", "history"]), choice]), fctx);
    const cantrips = ["light", "mage hand", "fire bolt"];
    const r = await wizard(spellChoice("wizard", cantrips, WIZARD_SPELLS.slice(0, 6)));
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.sheet.levels[0].choices[1]).toMatchObject({
      type: "spells", value: { class: fref("class:wizard|xphb"), cantrips: [{ name: "light" }, { name: "mage hand" }, { name: "fire bolt" }] },
    });
    expect((r.sheet.levels[0].choices[1].value as { spells: unknown[] }).spells).toHaveLength(6);
    expect(errs(await wizard(spellChoice("wizard", cantrips, WIZARD_SPELLS.slice(0, 5))))).toHaveProperty([SOURCE], "Conjuros: elige 6 conjuros.");
    expect(errs(await wizard(spellChoice("wizard", cantrips.slice(0, 2), WIZARD_SPELLS.slice(0, 6))))).toHaveProperty([SOURCE], "Conjuros: elige 3 trucos.");
    expect(errs(await wizard(spellChoice("wizard", cantrips, [...WIZARD_SPELLS.slice(0, 5), "fireball"]))))
      .toHaveProperty([SOURCE], "Conjuros: fireball es de nivel 3; el máximo es 1.");
  });
  describe("preparados iniciales", () => {
    const CLERIC_SPELLS = ["bless", "cure wounds", "healing word", "guiding bolt", "shield of faith"];
    for (const name of CLERIC_SPELLS) {
      extra(`spell:${name}|xphb`, {
        level: 1, school: "A", time: "", range: "", components: "", duration: "", concentration: false, ritual: false,
        classes: ["cleric"], tags: [],
      }, name);
    }
    const prep = (cls: string, names: string[]) => ({ [`class:${cls}|xphb`]: names.map((n) => fref(`spell:${n}|xphb`)) });
    const cleric = (prepared: unknown) => validateSheet({
      ...sheetFor("cleric", [
        skills(["history", "medicine"]), order("classFeature:protector|cleric|xphb|1"), spellChoice("cleric", CLERIC_CANTRIPS),
      ]),
      prepared,
    }, fctx);
    const wizard = (prepared: unknown) => validateSheet({
      ...sheetFor("wizard", [skills(["arcana", "history"]), spellChoice("wizard", ["light", "mage hand", "fire bolt"], WIZARD_SPELLS.slice(0, 6))]),
      prepared,
    }, fctx);

    it("Clérigo 1: guarda los preparados de su lista hasta el límite (4)", async () => {
      const r = await cleric(prep("cleric", CLERIC_SPELLS.slice(0, 4)));
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.sheet.prepared).toEqual(prep("cleric", CLERIC_SPELLS.slice(0, 4)));
      const none = await cleric(undefined);
      expect(none.ok && none.sheet.prepared).toEqual({});
    });
    it("nunca supera el límite", async () => {
      expect(errs(await cleric(prep("cleric", CLERIC_SPELLS)))).toEqual({ prepared: "Ya tienes 4 de 4 conjuros preparados." });
    });
    it("rechaza trucos, conjuros de otra lista, de nivel alto o de una clase que no es la suya", async () => {
      expect(errs(await cleric(prep("cleric", ["light"])))).toHaveProperty("prepared", "Los trucos no se preparan.");
      expect(errs(await cleric(prep("cleric", ["sleep"])))).toHaveProperty("prepared", "sleep no está en la lista de Cleric.");
      expect(errs(await wizard(prep("wizard", ["fireball"])))).toHaveProperty("prepared");
      expect(errs(await cleric(prep("wizard", ["bless"])))).toHaveProperty("prepared", "Esa clase no lanza conjuros.");
      expect(errs(await cleric({ "class:cleric|xphb": "bless" }))).toHaveProperty("prepared", "Conjuros preparados no válidos.");
      expect(errs(await cleric([]))).toHaveProperty("prepared", "Conjuros preparados no válidos.");
    });
    it("Mago 1: solo prepara de su libro", async () => {
      const r = await wizard(prep("wizard", WIZARD_SPELLS.slice(0, 4)));
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.sheet.prepared).toEqual(prep("wizard", WIZARD_SPELLS.slice(0, 4)));
      // El séptimo conjuro de la lista no está en el libro de 6
      expect(errs(await wizard(prep("wizard", [WIZARD_SPELLS[6]])))).toHaveProperty("prepared", "grease no está en tu libro de conjuros.");
    });
  });
  it("Orden divina con una opción que no es suya, o elección que no estaba pendiente → error", async () => {
    expect(choiceErrors(await validateSheet(sheetFor("cleric", [skills(["history", "medicine"]), order("classFeature:rage|barbarian|xphb|1")]), fctx))).not.toEqual([]);
    expect(choiceErrors(await validateSheet(sheetFor("cleric", [
      skills(["history", "medicine"]), order("classFeature:protector|cleric|xphb|1"),
      { type: "expertise", source: "classFeature:expertise|rogue|xphb|1", value: ["history"] },
    ]), fctx))).not.toEqual([]);
  });
  it("habilidades de clase: número, lista y sin repetir las del trasfondo o la especie", async () => {
    const withSkills = (s: string[]) => validateSheet(sheetFor("cleric", [skills(s), order("classFeature:protector|cleric|xphb|1")]), fctx);
    expect(choiceErrors(await withSkills(["history"]))).not.toEqual([]);
    expect(choiceErrors(await withSkills(["history", "stealth"]))).not.toEqual([]);
    expect(choiceErrors(await withSkills(["history", "insight"]))).not.toEqual([]);
  });
  const mastery = (...keys: string[]) => ({
    type: "weaponMastery", source: "progression:weapon mastery|barbarian|xphb", value: keys.map((k) => fref(`item:${k}|xphb`)),
  });
  const barbarian = (...extra: unknown[]) => sheetFor("barbarian", [skills(["athletics", "nature"]), ...extra]);
  it("Bárbaro 1 con 1 maestría → error (exige 2)", async () => {
    expect(choiceErrors(await validateSheet(barbarian(mastery("greataxe")), fctx))).not.toEqual([]);
    expect(errs(await validateSheet(barbarian(), fctx))).toHaveProperty("levels.0.choices");
  });
  it("Bárbaro 1 con 2 maestrías → ok y weaponMasteries con las dos", async () => {
    const r = await validateSheet(barbarian(mastery("greataxe", "handaxe")), fctx);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.sheet.weaponMasteries).toHaveLength(2);
    expect(r.sheet.weaponMasteries).toEqual([fref("item:greataxe|xphb"), fref("item:handaxe|xphb")]);
  });
  it("tiradas: guarda los dados si cuadran con los valores", async () => {
    const values = [15, 14, 13, 12, 10, 8];
    const dice = [[6, 5, 4, 1], [5, 5, 4, 2], [6, 4, 3, 1], [4, 4, 4, 3], [5, 3, 2, 1], [3, 3, 2, 1]];
    const s = barbarian(mastery("greataxe", "handaxe"));
    s.abilityMethod = "roll";
    s.rolls = { values, token: signRolls("u1", values), dice };
    const r = await validateSheet(s, fctx);
    expect(r.ok && r.sheet.rolls).toEqual({ values, token: s.rolls.token, dice });
    s.rolls = { ...s.rolls, dice: [[6, 6, 6, 6], ...dice.slice(1)] };
    const bad = await validateSheet(s, fctx);
    expect(bad.ok && bad.sheet.rolls?.dice).toBeUndefined();
  });

  const weaponMastery = (cls: string, ...keys: string[]) => ({
    type: "weaponMastery", source: `progression:weapon mastery|${cls}|xphb`, value: keys.map((k) => fref(`item:${k}|xphb`)),
  });
  const fightingStyle = (key: string) => ({ type: "feat", source: "progression:fs|fighter|xphb", value: [fnamed(key)] });
  it("Guerrero 1: puede elegir un arco largo como maestría (solo el Bárbaro está limitado a cuerpo a cuerpo)", async () => {
    const r = await validateSheet(sheetFor("fighter", [
      skills(["athletics", "history"]), fightingStyle("feat:archery|xphb"),
      weaponMastery("fighter", "greataxe", "handaxe", "longbow"),
    ]), fctx);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.sheet.weaponMasteries).toContainEqual(fref("item:longbow|xphb"));
    expect(r.sheet.levels[0].choices[1]).toEqual({
      type: "feat", source: "progression:fs|fighter|xphb", value: [{ ref: fref("feat:archery|xphb"), name: "Archery" }],
    });
  });
  it("Bárbaro 1 con un arco largo → error (solo cuerpo a cuerpo)", async () => {
    const r = await validateSheet(barbarian(mastery("greataxe", "longbow")), fctx);
    expect(errs(r)["levels.0.choices.progression:weapon mastery|barbarian|xphb"]).toMatch(/cuerpo a cuerpo/);
  });
  it("Guerrero 1: una dote que no es estilo de combate → error de validación", async () => {
    const r = await validateSheet(sheetFor("fighter", [
      skills(["athletics", "history"]), fightingStyle("feat:magic initiate; cleric|xphb"),
      weaponMastery("fighter", "greataxe", "handaxe", "longbow"),
    ]), fctx);
    expect(errs(r)["levels.0.choices.progression:fs|fighter|xphb"]).toMatch(/categoría/);
  });
  it("Guerrero 1: un estilo de combate solo del Paladín (Guerrero bendito) → error", async () => {
    extra("feat:blessed warrior|xphb", { category: "fightingStyle", categoryCode: "FS:P", repeatable: false }, "Blessed Warrior");
    const r = await validateSheet(sheetFor("fighter", [
      skills(["athletics", "history"]), fightingStyle("feat:blessed warrior|xphb"),
      weaponMastery("fighter", "greataxe", "handaxe", "longbow"),
    ]), fctx);
    expect(errs(r)["levels.0.choices.progression:fs|fighter|xphb"]).toMatch(/categoría/);
  });
  it("Pícaro 1: habilidades de clase y pericia entre ellas", async () => {
    const rogue = (expertise: string[], ...weapons: string[]) => sheetFor("rogue", [
      skills(["stealth", "acrobatics", "deception", "sleight of hand"]),
      { type: "expertise", source: "classFeature:expertise|rogue|xphb|1", value: expertise },
      weaponMastery("rogue", ...(weapons.length ? weapons : ["handaxe", "shortsword"])),
    ]);
    const ok = await validateSheet(rogue(["stealth", "insight"]), fctx);
    if (!ok.ok) throw new Error(JSON.stringify(ok.errors));
    expect(ok.sheet.levels[0].choices.map((c) => c.type)).toEqual(["skills", "weaponMastery", "expertise", "featSpells"]);
    // Pericia en una habilidad sin competencia, o repetida
    const expertiseKey = "levels.0.choices.classFeature:expertise|rogue|xphb|1";
    expect(choiceErrors(await validateSheet(rogue(["stealth", "athletics"]), fctx))).toEqual([expertiseKey]);
    expect(choiceErrors(await validateSheet(rogue(["stealth", "stealth"]), fctx))).toEqual([expertiseKey]);
    // Un arma marcial sin Sutil ni Ligera: sin competencia
    const r = await validateSheet(rogue(["stealth", "insight"], "handaxe", "greataxe"), fctx);
    expect(errs(r)["levels.0.choices.progression:weapon mastery|rogue|xphb"]).toMatch(/competencia/);
  });
});

describe("checkChoices: opciones escritas a mano", () => {
  const pending = [{
    type: "featureOption" as const, source: "subclassFeature:hunter's prey|ranger|xphb|hunter|xphb|3", count: 1,
    from: ["option:hunters-prey:colossus-slayer", "option:hunters-prey:horde-breaker"], label: "Presa del cazador",
  }];
  const cctx = {
    path: "levels.0.choices", entries: new Map(), resolve: async () => null, skills: [], weapons: [], level: 1, subclass: null,
  };
  const pick = (book: string, key: string) =>
    checkChoices(pending, [{ type: "featureOption", source: pending[0].source, value: { ref: { book, key }, name: "x" } }], cctx);
  it("acepta un id de la lista con libro builtin y pone el nombre en español", async () => {
    expect(await pick("builtin", "option:hunters-prey:horde-breaker")).toEqual({
      errors: {},
      choices: [{
        type: "featureOption", source: pending[0].source,
        value: { ref: { book: "builtin", key: "option:hunters-prey:horde-breaker" }, name: "Rompehordas" },
      }],
    });
  });
  it("rechaza ids de otro rasgo, de otro libro o inexistentes", async () => {
    const cases = [["builtin", "option:elemental-affinity:fire"], ["b1", "option:hunters-prey:horde-breaker"], ["builtin", "option:nope"]];
    for (const [book, key] of cases) {
      const r = await pick(book, key);
      expect(r.choices).toEqual([]);
      expect(Object.keys(r.errors)).toEqual([`levels.0.choices.${pending[0].source}`]);
    }
  });
});

describe("checkChoices: habilidades sin lista (cualquiera)", () => {
  const source = "subclassFeature:bonus proficiencies|bard|xphb|lore|xphb|3";
  const pending = [{ type: "skills" as const, source, count: 2, label: "Competencias adicionales" }];
  const cctx = {
    path: "choices", entries: new Map(), resolve: async () => null, skills: ["stealth"], weapons: [], level: 3, subclass: null,
  };
  const pick = (value: string[]) => checkChoices(pending, [{ type: "skills", source, value }], cctx);
  it("acepta habilidades que existen y rechaza las que no", async () => {
    expect((await pick(["arcana", "History"])).errors).toEqual({});
    expect(Object.keys((await pick(["arcana", "basket weaving"])).errors)).toEqual([`choices.${source}`]);
    expect(Object.keys((await pick(["arcana", "stealth"])).errors)).toEqual([`choices.${source}`]);
  });
});

describe("checkChoices: estilo de combate del Paladín", () => {
  const blessed: CatalogEntry = {
    ref: { book: "b1", key: "feat:blessed warrior|xphb" }, name: "Blessed Warrior", nameEs: null, bookName: "Libro",
    srd52: false, data: { category: "fightingStyle", categoryCode: "FS:P", repeatable: false }, description: "",
    descriptionEs: "", identifier: "blessed-warrior", parent: null, foundry: null,
  };
  const source = "progression:fs,fs:p|paladin|xphb";
  const cctx = {
    path: "choices", entries: new Map([["b1:feat:blessed warrior|xphb", blessed]]), resolve: async () => null,
    skills: [], weapons: [], level: 2, subclass: null,
  };
  it("Paladín 2 puede elegir Guerrero bendito", async () => {
    const pending = [{ type: "feat" as const, source, count: 1, category: ["FS", "FS:P"], label: "Estilo de combate" }];
    const r = await checkChoices(pending, [{ type: "feat", source, value: [{ ref: blessed.ref, name: "x" }] }], cctx);
    expect(r.errors).toEqual({});
    expect(r.choices[0]).toMatchObject({ value: [{ name: "Blessed Warrior" }] });
  });
});
