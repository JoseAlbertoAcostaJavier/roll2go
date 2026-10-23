import { beforeAll, describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/rules/catalog";
import { signHitDie, type HitDieRoll } from "@/lib/rules/dnd2024/rolls";
import type { Choice, Dnd2024SheetV2, LevelEntry } from "@/lib/rules/dnd2024/sheet";
import { validateLevel } from "@/lib/rules/dnd2024/validateLevel";
import type { Ref } from "@/lib/rules/types";
import { B, buildCatalog, ref } from "./fixtureCatalog";

beforeAll(() => {
  process.env.AUTH_SECRET = "secreto-de-prueba";
});

const cat = buildCatalog(["class-barbarian.json", "class-cleric.json", "class-fighter.json", "class-warlock.json"]);
// Dotes, invocaciones y armas que no están en los fixtures
const extra = (key: string, data: unknown, name: string) =>
  cat.set(`${B}:${key}`, { ...cat.get(`${B}:item:greataxe|xphb`)!, ref: ref(key), name, nameEs: null, data });
extra("item:shortsword|xphb", {
  type: "M", weight: 2, value: 1000,
  weapon: { damage: "1d6", damageType: "P", properties: ["F", "L"], mastery: "vex", category: "martial" },
}, "Shortsword");
extra("feat:great weapon master|xphb", {
  category: "general", prerequisite: "Level 4+, STR 13+", repeatable: false, abilityIncrease: ["str"],
}, "Great Weapon Master");
extra("feat:actor|xphb", { category: "general", prerequisite: "Level 4+, CHA 13+", repeatable: false, abilityIncrease: ["cha"] }, "Actor");
extra("feat:athlete|xphb", {
  category: "general", prerequisite: "Level 4+, STR 13+; or Level 4+, DEX 13+", repeatable: false, abilityIncrease: ["str", "dex"],
}, "Athlete");
extra("feat:boon of combat prowess|xphb", {
  category: "epicBoon", prerequisite: "Level 19+", repeatable: false, abilityIncrease: ["str", "dex", "con", "int", "wis", "cha"],
}, "Boon of Combat Prowess");
extra("optionalFeature:armor of shadows|xphb", { featureType: ["EI"] }, "Armor of Shadows");
extra("optionalFeature:mask of many faces|xphb", { featureType: ["EI"] }, "Mask of Many Faces");
extra("optionalFeature:misty visions|xphb", { featureType: ["EI"] }, "Misty Visions");

const ctx = (userId = "u1") => ({
  userId,
  characterId: "c1",
  books: [B],
  resolve: async (r: Ref): Promise<CatalogEntry | null> => (r.book === B ? (cat.get(`${B}:${r.key}`) ?? null) : null),
  entries: cat,
});

const cls = (name: string) => ref(`class:${name}|xphb`);
const named = (r: Ref) => ({ ref: r, name: cat.get(`${B}:${r.key}`)?.name ?? r.key });
const client = (key: string) => ({ ref: ref(key), name: "cliente" });

// Hoja v2 con niveles por clase (en orden); `extra` añade elecciones por nivel total
function sheetWith(classes: [string, number][], choices: Record<number, Choice[]> = {}): Dnd2024SheetV2 {
  const levels: LevelEntry[] = [];
  const perClass = new Map<string, number>();
  for (const [name, count] of classes) {
    for (let i = 0; i < count; i++) {
      const classLevel = (perClass.get(name) ?? 0) + 1;
      perClass.set(name, classLevel);
      const n = levels.length + 1;
      levels.push({
        n, class: named(cls(name)), classLevel, hp: { method: n === 1 ? "max" : "average", value: 7 },
        choices: choices[n] ?? [],
      });
    }
  }
  return {
    version: 2,
    species: named(ref("species:elf|xphb")),
    lineage: null,
    background: { ...named(ref("background:acolyte|xphb")), abilities: { wis: 2, int: 1 }, equipment: "A" },
    abilityMethod: "standard",
    baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    rolls: null,
    speciesChoices: { skills: [], size: null },
    alignment: "", appearance: "", age: "", languages: "", notes: "", xp: 0,
    hp: { max: null, current: null, temp: 0 },
    levels,
    classesSummary: [],
    inventory: { items: [], coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, other: "" },
    prepared: {},
    spellbookExtra: [],
    slotsUsed: {},
    weaponMasteries: [],
  };
}

// Maestrías actuales: las elegidas en el historial
const withMasteries = (s: Dnd2024SheetV2) => {
  s.weaponMasteries = s.levels.flatMap((l) => l.choices.flatMap((c) => (c.type === "weaponMastery" ? c.value : [])));
  return s;
};
const MASTERY = "progression:weapon mastery|barbarian|xphb";
const ASI = "classFeature:ability score improvement|barbarian|xphb|4";
const INVOCATIONS = "progression:eldritch invocations|warlock|xphb";
// Bárbaro 3 (Berserker) con sus elecciones; sube a 4
const barbarian3 = () => withMasteries(sheetWith([["barbarian", 3]], {
  1: [
    { type: "skills", source: "class:skills", value: ["athletics", "intimidation"] },
    { type: "weaponMastery", source: MASTERY, value: [ref("item:greataxe|xphb"), ref("item:handaxe|xphb")] },
  ],
  3: [
    { type: "subclass", source: "class:subclass", value: named(ref("subclass:path of the berserker|barbarian|xphb")) },
    { type: "skills", source: "classFeature:primal knowledge|barbarian|xphb|3", value: ["survival"] },
  ],
}));
const mastery = (key = "shortsword") => ({ type: "weaponMastery", source: MASTERY, value: [ref(`item:${key}|xphb`)] });
const asi = (value: unknown) => ({ type: "asi", source: ASI, value });
const average = { method: "average", value: 7 };
const input = (over: Record<string, unknown> = {}) => ({
  expectedLevel: 4, class: client("class:barbarian|xphb"),
  choices: [asi({ abilities: { str: 2 } }), mastery()], hp: average, ...over,
});
const errorsOf = async (sheet: Dnd2024SheetV2, body: unknown, userId = "u1") => {
  const r = await validateLevel(sheet, body, ctx(userId));
  return r.ok ? {} : r.errors;
};

describe("validateLevel", () => {
  it("Bárbaro 3 → 4 con mejora, maestría y PG medios: entrada con los nombres del catálogo", async () => {
    const r = await validateLevel(barbarian3(), input(), ctx());
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.entry).toEqual({
      n: 4, class: { ref: cls("barbarian"), name: "Barbarian" }, classLevel: 4, hp: { method: "average", value: 7 },
      choices: [
        { type: "asi", source: ASI, value: { abilities: { str: 2 } } },
        { type: "weaponMastery", source: MASTERY, value: [ref("item:shortsword|xphb")] },
      ],
    });
  });

  it("elección que el nivel no pide, o que falta → error en choices", async () => {
    const extraChoice = { type: "expertise", source: "classFeature:expertise|rogue|xphb|1", value: ["athletics"] };
    expect(await errorsOf(barbarian3(), input({ choices: [asi({ abilities: { str: 2 } }), mastery(), extraChoice] })))
      .toHaveProperty("choices");
    expect(await errorsOf(barbarian3(), input({ choices: [asi({ abilities: { str: 2 } })] }))).toHaveProperty("choices");
  });

  it("mejora de característica: +2 a una o +1 a dos, sin pasar de 20", async () => {
    const sheet = barbarian3();
    sheet.baseAbilities.str = 19;
    expect(await errorsOf(sheet, input())).toHaveProperty([`choices.${ASI}`]);
    expect(await errorsOf(sheet, input({ choices: [asi({ abilities: { str: 1, dex: 1 } }), mastery()] }))).toEqual({});
    expect(await errorsOf(sheet, input({ choices: [asi({ abilities: { str: 1 } }), mastery()] }))).toHaveProperty([`choices.${ASI}`]);
    expect(await errorsOf(sheet, input({ choices: [asi({ abilities: { dex: 2, con: 1 } }), mastery()] })))
      .toHaveProperty([`choices.${ASI}`]);
  });

  it("dote general en lugar de la mejora: prerrequisitos, característica que sube y nombre del catálogo", async () => {
    // FUE 15: cumple Gran maestro de armas; CAR 8: no cumple Actor
    const gwm = { feat: client("feat:great weapon master|xphb"), ability: "str" };
    const r = await validateLevel(barbarian3(), input({ choices: [asi(gwm), mastery()] }), ctx());
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.entry.choices[0]).toEqual({
      type: "asi", source: ASI,
      value: { feat: { ref: ref("feat:great weapon master|xphb"), name: "Great Weapon Master" }, ability: "str" },
    });
    const actor = { feat: client("feat:actor|xphb"), ability: "cha" };
    expect(await errorsOf(barbarian3(), input({ choices: [asi(actor), mastery()] }))).toHaveProperty([`choices.${ASI}`]);
    // Característica que la dote no mejora, o sin elegir cuando hay varias
    const wrong = { feat: client("feat:athlete|xphb"), ability: "con" };
    expect(await errorsOf(barbarian3(), input({ choices: [asi(wrong), mastery()] }))).toHaveProperty([`choices.${ASI}`]);
    const none = { feat: client("feat:athlete|xphb") };
    expect(await errorsOf(barbarian3(), input({ choices: [asi(none), mastery()] }))).toHaveProperty([`choices.${ASI}`]);
    // Un don épico no es una dote general
    const boon = { feat: client("feat:boon of combat prowess|xphb"), ability: "str" };
    expect(await errorsOf(barbarian3(), input({ choices: [asi(boon), mastery()] }))).toHaveProperty([`choices.${ASI}`]);
  });

  it("maestría con un arma que ya tiene → error", async () => {
    expect(await errorsOf(barbarian3(), input({ choices: [asi({ abilities: { str: 2 } }), mastery("greataxe")] })))
      .toHaveProperty([`choices.${MASTERY}`]);
  });

  describe("Brujo", () => {
    const warlock1 = () => sheetWith([["warlock", 1]], {
      1: [
        { type: "skills", source: "class:skills", value: ["arcana", "deception"] },
        { type: "optionalFeature", source: INVOCATIONS, value: [named(ref("optionalFeature:armor of shadows|xphb"))] },
      ],
    });
    const invocations = (keys: string[], replaced?: string[]) => ({
      expectedLevel: 2, class: client("class:warlock|xphb"), hp: { method: "average", value: 5 },
      choices: [{
        type: "optionalFeature", source: INVOCATIONS, value: keys.map((k) => client(`optionalFeature:${k}|xphb`)),
        ...(replaced ? { replaced: replaced.map((k) => client(`optionalFeature:${k}|xphb`)) } : {}),
      }],
    });

    it("Brujo 2: dos invocaciones nuevas", async () => {
      const r = await validateLevel(warlock1(), invocations(["mask of many faces", "misty visions"]), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.choices[0]).toMatchObject({ type: "optionalFeature", value: [{ name: "Mask of Many Faces" }, { name: "Misty Visions" }] });
    });
    it("invocación con prerrequisito de nivel 5 a Brujo 2 → error", async () => {
      expect(await errorsOf(warlock1(), invocations(["mask of many faces", "ascendant step"])))
        .toHaveProperty([`choices.${INVOCATIONS}`]);
    });
    it("una invocación que ya tiene → error", async () => {
      expect(await errorsOf(warlock1(), invocations(["mask of many faces", "armor of shadows"])))
        .toHaveProperty([`choices.${INVOCATIONS}`]);
    });
    it("sustituir una que tiene: las dos nuevas más la que entra en su lugar; no una que no tiene", async () => {
      extra("optionalFeature:devil's sight|xphb", { featureType: ["EI"] }, "Devil's Sight");
      const three = ["mask of many faces", "misty visions", "devil's sight"];
      const r = await validateLevel(warlock1(), invocations(three, ["armor of shadows"]), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.choices[0]).toMatchObject({ replaced: [{ name: "Armor of Shadows" }] });
      expect(await errorsOf(warlock1(), invocations(three.slice(0, 2), ["armor of shadows"])))
        .toHaveProperty([`choices.${INVOCATIONS}`]);
      expect(await errorsOf(warlock1(), invocations(three, ["eldritch smite"]))).toHaveProperty([`choices.${INVOCATIONS}`]);
    });
  });

  it("requisito de multiclase no cumplido (CAR 8 para Brujo) → error en class; cumplido (SAB 13 para Clérigo) → ok", async () => {
    const body = { expectedLevel: 4, class: client("class:warlock|xphb"), choices: [], hp: { method: "average", value: 5 } };
    expect((await errorsOf(barbarian3(), body)).class).toMatch(/Carisma/);
    const sheet = barbarian3();
    sheet.baseAbilities.wis = 11;
    const order = { type: "featureOption", source: "classFeature:divine order|cleric|xphb|1", value: client("classFeature:protector|cleric|xphb|1") };
    const r = await validateLevel(sheet, { ...body, class: client("class:cleric|xphb"), choices: [order] }, ctx());
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.entry).toMatchObject({ n: 4, classLevel: 1, class: { name: "Cleric" } });
  });

  it("nivel 21 → error; nivel esperado distinto del siguiente → error", async () => {
    const body = { expectedLevel: 21, class: client("class:barbarian|xphb"), choices: [], hp: average };
    expect(await errorsOf(sheetWith([["barbarian", 20]]), body)).toHaveProperty("level");
    expect(await errorsOf(barbarian3(), input({ expectedLevel: 5 }))).toHaveProperty("expectedLevel");
    expect(await errorsOf(barbarian3(), input({ expectedLevel: "4" }))).toHaveProperty("expectedLevel");
  });

  it("clase de un libro no utilizable o que no existe → error", async () => {
    expect(await errorsOf(barbarian3(), input({ class: { ref: { book: "otro", key: "class:barbarian|xphb" }, name: "x" } })))
      .toHaveProperty("class");
    expect(await errorsOf(barbarian3(), input({ class: client("class:nope|xphb") }))).toHaveProperty("class");
  });

  describe("puntos de golpe", () => {
    it("media: floor(d12/2) + 1 = 7; otro valor → error", async () => {
      expect(await errorsOf(barbarian3(), input({ hp: { method: "average", value: 6 } }))).toHaveProperty("hp");
      expect(await errorsOf(barbarian3(), input({ hp: { method: "average", value: 7 } }))).toEqual({});
    });
    it("tirada: token propio → ok y se guarda; ajeno, caducado o 13 en d12 → error", async () => {
      const roll = (value: number, token: string) => input({ hp: { method: "roll", value, token } });
      const sign = (userId: string, value: number, over: Partial<HitDieRoll> = {}, now?: number) =>
        signHitDie(userId, { characterId: "c1", n: 4, die: 12, value, ...over }, now);
      const r = await validateLevel(barbarian3(), roll(9, sign("u1", 9)), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.hp).toEqual({ method: "roll", value: 9, token: expect.any(String) });
      expect(await errorsOf(barbarian3(), roll(9, sign("u2", 9)))).toHaveProperty("hp");
      expect(await errorsOf(barbarian3(), roll(9, sign("u1", 9, {}, Date.now() - 25 * 3600 * 1000)))).toHaveProperty("hp");
      expect(await errorsOf(barbarian3(), roll(13, sign("u1", 13)))).toHaveProperty("hp");
      expect(await errorsOf(barbarian3(), roll(9, sign("u1", 9, { die: 10 })))).toHaveProperty("hp");
      // Token de otro personaje o de otro nivel
      expect(await errorsOf(barbarian3(), roll(9, sign("u1", 9, { characterId: "c2" })))).toHaveProperty("hp");
      expect(await errorsOf(barbarian3(), roll(9, sign("u1", 9, { n: 5 })))).toHaveProperty("hp");
    });
    it("máximo fuera del nivel 1 de la primera clase → error; método desconocido → error", async () => {
      expect(await errorsOf(barbarian3(), input({ hp: { method: "max", value: 12 } }))).toHaveProperty("hp");
      expect(await errorsOf(barbarian3(), input({ hp: { method: "otro", value: 7 } }))).toHaveProperty("hp");
    });
  });

  it("subclase al llegar a su nivel: se exige y su nombre sale del catálogo", async () => {
    const sheet = sheetWith([["barbarian", 2]], {
      1: [{ type: "weaponMastery", source: MASTERY, value: [ref("item:greataxe|xphb"), ref("item:handaxe|xphb")] }],
    });
    const knowledge = { type: "skills", source: "classFeature:primal knowledge|barbarian|xphb|3", value: ["survival"] };
    const body = { expectedLevel: 3, class: client("class:barbarian|xphb"), hp: average };
    expect(await errorsOf(sheet, { ...body, choices: [knowledge] })).toHaveProperty(["choices.class:subclass"]);
    const sub = { type: "subclass", source: "class:subclass", value: client("subclass:path of the berserker|barbarian|xphb") };
    const r = await validateLevel(sheet, { ...body, choices: [sub, knowledge] }, ctx());
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.entry.choices[0]).toEqual({
      type: "subclass", source: "class:subclass",
      value: { ref: ref("subclass:path of the berserker|barbarian|xphb"), name: "Path of the Berserker" },
    });
    // Una subclase de otra clase no vale
    const other = { ...sub, value: client("subclass:battle master|fighter|xphb") };
    expect(await errorsOf(sheet, { ...body, choices: [other, knowledge] })).toHaveProperty(["choices.class:subclass"]);
  });

  it("don épico a nivel 19: la característica puede pasar de 20; con una dote general, no", async () => {
    const sheet = sheetWith([["barbarian", 18]]);
    sheet.baseAbilities.str = 20;
    const boon = (key: string, ability: string) => ({
      expectedLevel: 19, class: client("class:barbarian|xphb"), hp: average,
      choices: [{ type: "feat", source: "progression:eb|barbarian|xphb", value: [{ ...client(`feat:${key}|xphb`), ability }] }],
    });
    const r = await validateLevel(sheet, boon("boon of combat prowess", "str"), ctx());
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.entry.choices[0]).toEqual({
      type: "feat", source: "progression:eb|barbarian|xphb",
      value: [{ ref: ref("feat:boon of combat prowess|xphb"), name: "Boon of Combat Prowess", ability: "str" }],
    });
    expect(await errorsOf(sheet, boon("great weapon master", "str"))).toHaveProperty(["choices.progression:eb|barbarian|xphb"]);
  });

  it("entrada no válida → error", async () => {
    expect(await errorsOf(barbarian3(), null)).not.toEqual({});
    expect(await errorsOf(barbarian3(), input({ choices: "x" }))).toHaveProperty("choices");
  });

  it("rasgo de una subclase que ya tiene, con opciones, por encima del nivel de subclase: se exige y se acepta", async () => {
    const SUB = "subclass:path of testing|barbarian|xphb";
    const FEATURE = "subclassFeature:testing choice|barbarian|xphb|testing|xphb|7";
    extra("classFeature:option a|barbarian|xphb|7", { level: 7, className: "Barbarian" }, "Option A");
    extra("classFeature:option b|barbarian|xphb|7", { level: 7, className: "Barbarian" }, "Option B");
    extra(FEATURE, {
      level: 7, className: "Barbarian", subclassName: "Testing",
      options: [ref("classFeature:option a|barbarian|xphb|7"), ref("classFeature:option b|barbarian|xphb|7")],
    }, "Testing Choice");
    extra(SUB, { features: [{ ref: ref(FEATURE), level: 7 }], spells: [], progressions: { feats: [], optionalFeatures: [] } }, "Path of Testing");
    cat.get(`${B}:${SUB}`)!.parent = cls("barbarian");
    const sheet = sheetWith([["barbarian", 6]], {
      3: [{ type: "subclass", source: "class:subclass", value: named(ref(SUB)) }],
    });
    // Como la hoja: solo la clase y la subclase cargadas, sin los rasgos de nivel 7
    const entries = new Map([...cat].filter(([k]) => !k.endsWith(FEATURE) && !k.includes("|7")));
    const body = (choices: unknown[]) => ({ expectedLevel: 7, class: client("class:barbarian|xphb"), hp: average, choices });
    const missing = await validateLevel(sheet, body([]), { ...ctx(), entries });
    expect(missing.ok ? {} : missing.errors).toHaveProperty("choices");
    const option = { type: "featureOption", source: FEATURE, value: client("classFeature:option b|barbarian|xphb|7") };
    const r = await validateLevel(sheet, body([option]), { ...ctx(), entries });
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.entry.choices).toEqual([{ ...option, value: { ref: ref("classFeature:option b|barbarian|xphb|7"), name: "Option B" } }]);
  });

  it("referencias de una elección de un libro no utilizable → error", async () => {
    const other = (key: string) => ({ ref: { book: "otro", key }, name: "x" });
    const weapon = { type: "weaponMastery", source: MASTERY, value: [{ book: "otro", key: "item:shortsword|xphb" }] };
    expect(await errorsOf(barbarian3(), input({ choices: [asi({ abilities: { str: 2 } }), weapon] })))
      .toHaveProperty([`choices.${MASTERY}`]);
    const feat = asi({ feat: other("feat:great weapon master|xphb"), ability: "str" });
    expect(await errorsOf(barbarian3(), input({ choices: [feat, mastery()] }))).toHaveProperty([`choices.${ASI}`]);
  });
});
