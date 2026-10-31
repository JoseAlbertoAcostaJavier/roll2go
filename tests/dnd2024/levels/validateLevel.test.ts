import { beforeAll, describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { signHitDie, type HitDieRoll } from "@/lib/rules/dnd2024/creation/rolls";
import type { Choice, Dnd2024SheetV2, LevelEntry } from "@/lib/rules/dnd2024/sheet/sheet";
import { validateLevel } from "@/lib/rules/dnd2024/levels/validateLevel";
import type { Ref } from "@/lib/rules/types";
import { B, buildCatalog, ref } from "../fixtureCatalog";

beforeAll(() => {
  process.env.AUTH_SECRET = "secreto-de-prueba";
});

const cat = buildCatalog([
  "class-barbarian.json", "class-cleric.json", "class-fighter.json", "class-warlock.json", "class-wizard.json", "class-bard.json",
]);
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
const DAMAGE_TYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
extra("feat:boon of energy resistance|xphb", {
  category: "epicBoon", prerequisite: "Level 19+", repeatable: false, abilityIncrease: ["str", "dex", "con", "int", "wis", "cha"],
  defenses: { resist: [{ choose: { from: ["acid", "cold", "fire", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"], count: 2 } }] },
}, "Boon of Energy Resistance");
// (dote general inventada con la misma elección, para probarla en lugar de una mejora de característica)
extra("feat:warded|xphb", {
  category: "general", repeatable: false, abilityIncrease: ["str"],
  defenses: { resist: [{ choose: { from: DAMAGE_TYPES, count: 1 } }] },
}, "Warded");
extra("optionalFeature:armor of shadows|xphb", { featureType: ["EI"] }, "Armor of Shadows");
extra("optionalFeature:mask of many faces|xphb", { featureType: ["EI"] }, "Mask of Many Faces");
extra("optionalFeature:misty visions|xphb", { featureType: ["EI"] }, "Misty Visions");
extra("spell:command|xphb", {
  level: 1, school: "E", time: "", range: "", components: "", duration: "", concentration: false, ritual: false,
  classes: ["cleric"], tags: [],
}, "Command");
// Conjuros: nombre, nivel y listas
for (const [name, level, classes] of [
  ["eldritch blast", 0, ["warlock"]], ["chill touch", 0, ["warlock", "wizard"]], ["minor illusion", 0, ["warlock", "wizard"]],
  ["hex", 1, ["warlock"]], ["armor of agathys", 1, ["warlock"]], ["witch bolt", 1, ["warlock", "wizard"]],
  ["charm person", 1, ["warlock", "wizard"]], ["hold person", 2, ["warlock", "wizard"]], ["burning hands", 1, ["wizard"]],
  ["magic missile", 1, ["wizard"]], ["shield", 1, ["wizard"]],
  ["light", 0, ["cleric", "wizard"]], ["sacred flame", 0, ["cleric"]], ["guidance", 0, ["cleric"]],
  ["thaumaturgy", 0, ["cleric"]], ["bless", 1, ["cleric"]], ["dancing lights", 0, ["warlock"]],
  ["vicious mockery", 0, ["bard"]], ["healing word", 1, ["bard", "cleric"]],
  ["circle of death", 6, ["sorcerer", "warlock", "wizard"]], ["chain lightning", 6, ["sorcerer", "wizard"]],
  ["finger of death", 7, ["sorcerer", "warlock", "wizard"]],
] as [string, number, string[]][]) {
  extra(`spell:${name}|xphb`, {
    level, school: "V", time: "", range: "", components: "", duration: "", concentration: false, ritual: false, classes, tags: [],
  }, name);
}

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

  it("dote con un conjuro a elegir (Tocado por los feéricos): exige uno de nivel 1 de Encantamiento o Adivinación", async () => {
    const fey = asi({ feat: client("feat:fey-touched|xphb"), ability: "wis" });
    const SOURCE = "featSpells:feat:fey-touched|xphb";
    const spells = (names: string[]) => ({
      type: "featSpells", source: SOURCE, value: { cantrips: [], spells: names.map((n) => client(`spell:${n}|xphb`)) },
    });
    const r = await validateLevel(barbarian3(), input({ choices: [fey, mastery(), spells(["command"])] }), ctx());
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.entry.choices.at(-1)).toEqual({
      type: "featSpells", source: SOURCE,
      value: { feat: ref("feat:fey-touched|xphb"), cantrips: [], spells: [{ ref: ref("spell:command|xphb"), name: "Command" }] },
    });
    expect(await errorsOf(barbarian3(), input({ choices: [fey, mastery()] })))
      .toHaveProperty("choices", "Falta elegir: Conjuros de Fey-Touched.");
    expect(await errorsOf(barbarian3(), input({ choices: [fey, mastery(), spells(["bless"])] })))
      .toHaveProperty([`choices.${SOURCE}`]);
    // Sin la dote, la elección sobra
    expect(await errorsOf(barbarian3(), input({ choices: [asi({ abilities: { str: 2 } }), mastery(), spells(["command"])] })))
      .toHaveProperty("choices", "Hay elecciones que este nivel no pide.");
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
    const SPELLS = "progression:spells|warlock|xphb";
    // Brujo 2: 1 conjuro aprendido nuevo (sin trucos nuevos)
    const learn = (spells = ["hex"], extraValue: object = {}) =>
      ({ type: "spells", source: SPELLS, value: { cantrips: [], spells: spells.map((n) => client(`spell:${n}|xphb`)), ...extraValue } });
    const invocations = (keys: string[], replaced?: string[], spells = learn()) => ({
      expectedLevel: 2, class: client("class:warlock|xphb"), hp: { method: "average", value: 5 },
      choices: [{
        type: "optionalFeature", source: INVOCATIONS, value: keys.map((k) => client(`optionalFeature:${k}|xphb`)),
        ...(replaced ? { replaced: replaced.map((k) => client(`optionalFeature:${k}|xphb`)) } : {}),
      }, spells],
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

    describe("conjuros", () => {
      const two = ["mask of many faces", "misty visions"];
      const spellErrors = async (sheet: Dnd2024SheetV2, spells: unknown) =>
        (await errorsOf(sheet, invocations(two, undefined, spells as ReturnType<typeof learn>)))[`choices.${SPELLS}`];
      // Brujo 1 con sus trucos y conjuros
      const known = () => {
        const s = warlock1();
        s.levels[0].choices.push({
          type: "spells", source: SPELLS, value: {
            class: cls("warlock"), cantrips: [named(ref("spell:eldritch blast|xphb")), named(ref("spell:chill touch|xphb"))],
            spells: [named(ref("spell:hex|xphb")), named(ref("spell:armor of agathys|xphb"))],
          },
        });
        return s;
      };

      it("exige el número exacto de conjuros nuevos, con los nombres del catálogo", async () => {
        const r = await validateLevel(warlock1(), invocations(two), ctx());
        if (!r.ok) throw new Error(JSON.stringify(r.errors));
        expect(r.entry.choices[1]).toEqual({
          type: "spells", source: SPELLS,
          value: { class: cls("warlock"), cantrips: [], spells: [{ ref: ref("spell:hex|xphb"), name: "hex" }] },
        });
        expect(await spellErrors(warlock1(), learn([]))).toBe("Conjuros: elige 1 conjuro.");
        expect(await spellErrors(warlock1(), learn(["hex", "witch bolt"]))).toBe("Conjuros: elige 1 conjuro.");
        expect(await spellErrors(warlock1(), learn(["hex"], { cantrips: [client("spell:minor illusion|xphb")] })))
          .toBe("Conjuros: elige 0 trucos.");
        expect(await errorsOf(warlock1(), invocations(two, undefined, null as never))).toHaveProperty("choices");
      });
      it("un truco que ya da el legado (Drow → Luces danzantes) no entra como sustituto", async () => {
        const drow = known();
        drow.lineage = named(ref("lineage:drow|xphb"));
        const swap = { replaceCantrip: { out: client("spell:chill touch|xphb"), in: client("spell:dancing lights|xphb") } };
        expect(await spellErrors(drow, learn(["witch bolt"], swap))).toBe("Conjuros: ya tienes dancing lights.");
        expect(await spellErrors(known(), learn(["witch bolt"], swap))).toBeUndefined();
      });
      it("de otra lista, de nivel demasiado alto, un truco o uno que ya conoce → error", async () => {
        expect(await spellErrors(warlock1(), learn(["burning hands"]))).toMatch(/no está en la lista/);
        expect(await spellErrors(warlock1(), learn(["hold person"]))).toMatch(/nivel 2; el máximo es 1/);
        expect(await spellErrors(warlock1(), learn(["eldritch blast"]))).toMatch(/no es un conjuro de nivel 1/);
        expect(await spellErrors(known(), learn(["hex"]))).toBe("Conjuros: ya tienes hex.");
      });
      it("acepta una sustitución válida (un conjuro aprendido por otro de la lista)", async () => {
        const replace = { out: client("spell:hex|xphb"), in: client("spell:charm person|xphb") };
        const r = await validateLevel(known(), invocations(two, undefined, learn(["witch bolt"], { replace })), ctx());
        if (!r.ok) throw new Error(JSON.stringify(r.errors));
        expect((r.entry.choices[1].value as { replace: unknown }).replace).toEqual({
          out: { ref: ref("spell:hex|xphb"), name: "hex" }, in: { ref: ref("spell:charm person|xphb"), name: "charm person" },
        });
        // También un truco por otro truco (en `replaceCantrip`)
        const cantrip = { out: client("spell:chill touch|xphb"), in: client("spell:minor illusion|xphb") };
        expect(await spellErrors(known(), learn(["witch bolt"], { replaceCantrip: cantrip }))).toBeUndefined();
      });
      it("sustituye un truco y un conjuro en la misma subida", async () => {
        const body = learn(["witch bolt"], {
          replace: { out: client("spell:hex|xphb"), in: client("spell:charm person|xphb") },
          replaceCantrip: { out: client("spell:chill touch|xphb"), in: client("spell:minor illusion|xphb") },
        });
        const r = await validateLevel(known(), invocations(two, undefined, body), ctx());
        if (!r.ok) throw new Error(JSON.stringify(r.errors));
        expect(r.entry.choices[1].value).toMatchObject({
          replace: { out: { name: "hex" }, in: { name: "charm person" } },
          replaceCantrip: { out: { name: "chill touch" }, in: { name: "minor illusion" } },
        });
      });
      it("sustitución no válida: uno que no conoce, de otro tipo, uno que ya tiene o el mismo que aprende → error", async () => {
        const bad = (out: string, inn: string, spells = ["witch bolt"]) =>
          spellErrors(known(), learn(spells, { replace: { out: client(`spell:${out}|xphb`), in: client(`spell:${inn}|xphb`) } }));
        expect(await bad("charm person", "hold person")).toMatch(/solo puedes sustituir/);
        expect(await bad("hex", "minor illusion")).toMatch(/no es un conjuro de nivel 1/);
        // Un truco en `replace` o un conjuro de nivel en `replaceCantrip` → error
        expect(await bad("chill touch", "minor illusion")).toMatch(/solo puedes sustituir un conjuro/);
        const cantripSwap = (out: string, inn: string) => spellErrors(known(),
          learn(["witch bolt"], { replaceCantrip: { out: client(`spell:${out}|xphb`), in: client(`spell:${inn}|xphb`) } }));
        expect(await cantripSwap("hex", "charm person")).toMatch(/solo puedes sustituir un truco/);
        expect(await cantripSwap("chill touch", "charm person")).toMatch(/no es un truco/);
        expect(await cantripSwap("chill touch", "eldritch blast")).toBe("Conjuros: ya tienes eldritch blast.");
        expect(await bad("hex", "armor of agathys")).toBe("Conjuros: ya tienes armor of agathys.");
        expect(await bad("hex", "witch bolt")).toBe("Conjuros: ya tienes witch bolt.");
      });
    });
  });

  describe("Mago: libro de conjuros", () => {
    const SPELLS = "progression:spells|wizard|xphb";
    const book = ["burning hands", "witch bolt", "charm person"];
    const wizard1 = () => {
      const s = sheetWith([["wizard", 1]], {
        1: [{
          type: "spells", source: SPELLS, value: {
            class: cls("wizard"), cantrips: [named(ref("spell:light|xphb")), named(ref("spell:chill touch|xphb"))],
            spells: book.map((n) => named(ref(`spell:${n}|xphb`))),
          },
        }],
      });
      s.baseAbilities.int = 15;
      return s;
    };
    const spellErrors = async (value: object) => (await errorsOf(wizard1(), {
      expectedLevel: 2, class: client("class:wizard|xphb"), hp: { method: "average", value: 4 },
      choices: [{ type: "spells", source: SPELLS, value }],
    }))[`choices.${SPELLS}`];
    const spells = (names: string[]) => names.map((n) => client(`spell:${n}|xphb`));
    const two = spells(["magic missile", "shield"]);

    it("Mago 2: 2 entradas nuevas de su lista y nivel, que no estén ya en el libro", async () => {
      expect(await spellErrors({ cantrips: [], spells: two })).toBeUndefined();
      expect(await spellErrors({ cantrips: [], spells: spells(["magic missile"]) })).toBe("Conjuros: elige 2 conjuros.");
      expect(await spellErrors({ cantrips: [], spells: spells(["magic missile", "hold person"]) })).toMatch(/nivel 2; el máximo es 1/);
      expect(await spellErrors({ cantrips: [], spells: spells(["magic missile", "hex"]) })).toMatch(/no está en la lista/);
      expect(await spellErrors({ cantrips: [], spells: spells(["magic missile", "burning hands"]) }))
        .toBe("Conjuros: ya tienes burning hands.");
      expect(await spellErrors({ cantrips: [], spells: spells(["shield", "shield"]) })).toBe("Conjuros: conjuro repetido.");
    });
    it("sustituye un truco, pero nunca un conjuro del libro", async () => {
      const replace = (out: string, inn: string) => ({ out: client(`spell:${out}|xphb`), in: client(`spell:${inn}|xphb`) });
      expect(await spellErrors({ cantrips: [], spells: two, replaceCantrip: replace("light", "minor illusion") })).toBeUndefined();
      // El libro no admite `replace` (modo spellbook), ni un conjuro del libro como truco
      expect(await spellErrors({ cantrips: [], spells: two, replace: replace("burning hands", "magic missile") }))
        .toMatch(/no puedes sustituir conjuros/);
      expect(await spellErrors({ cantrips: [], spells: two, replaceCantrip: replace("burning hands", "minor illusion") }))
        .toMatch(/solo puedes sustituir un truco/);
    });
  });

  describe("estilo de combate del Guerrero", () => {
    const FS = "progression:fs|fighter|xphb";
    extra("feat:archery|xphb", { category: "fightingStyle", categoryCode: "FS", repeatable: false }, "Archery");
    extra("feat:defense|xphb", { category: "fightingStyle", categoryCode: "FS", repeatable: false }, "Defense");
    extra("feat:blessed warrior|xphb", { category: "fightingStyle", categoryCode: "FS:P", repeatable: false }, "Blessed Warrior");
    const fighter1 = () => sheetWith([["fighter", 1]], {
      1: [{ type: "feat", source: FS, value: [named(ref("feat:archery|xphb"))] }],
    });
    const replace = (key: string) => ({
      expectedLevel: 2, class: client("class:fighter|xphb"), hp: { method: "average", value: 6 },
      choices: [{ type: "feat", source: FS, value: [client(`feat:${key}|xphb`)], replaced: [client("feat:archery|xphb")] }],
    });
    it("Guerrero 2: sustituye su estilo por otro del Guerrero, no por uno del Paladín", async () => {
      const r = await validateLevel(fighter1(), replace("defense"), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect((await errorsOf(fighter1(), replace("blessed warrior")))[`choices.${FS}`]).toMatch(/categoría/);
    });
  });

  it("requisito de multiclase no cumplido (CAR 8 para Brujo) → error en class; cumplido (SAB 13 para Clérigo) → ok", async () => {
    const body = { expectedLevel: 4, class: client("class:warlock|xphb"), choices: [], hp: { method: "average", value: 5 } };
    expect((await errorsOf(barbarian3(), body)).class).toMatch(/Carisma/);
    const sheet = barbarian3();
    sheet.baseAbilities.wis = 11;
    const order = { type: "featureOption", source: "classFeature:divine order|cleric|xphb|1", value: client("classFeature:protector|cleric|xphb|1") };
    const cantrips = ["light", "sacred flame", "guidance"].map((n) => client(`spell:${n}|xphb`));
    const spells = { type: "spells", source: "progression:spells|cleric|xphb", value: { cantrips, spells: [] } };
    const r = await validateLevel(sheet, { ...body, class: client("class:cleric|xphb"), choices: [order, spells] }, ctx());
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

  it("don de resistencia a la energía: elige dos tipos de daño de la lista, sin repetir", async () => {
    const sheet = sheetWith([["barbarian", 18]]);
    const source = "progression:eb|barbarian|xphb";
    const boon = (resist?: unknown) => ({
      expectedLevel: 19, class: client("class:barbarian|xphb"), hp: average,
      choices: [{ type: "feat", source, value: [{ ...client("feat:boon of energy resistance|xphb"), ability: "str", ...(resist ? { resist } : {}) }] }],
    });
    const r = await validateLevel(sheet, boon(["cold", "fire"]), ctx());
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.entry.choices[0]).toMatchObject({ type: "feat", value: [{ ability: "str", resist: ["cold", "fire"] }] });
    expect((await errorsOf(sheet, boon(["cold"])))[`choices.${source}`]).toContain("elige 2 tipos de daño.");
    expect((await errorsOf(sheet, boon()))[`choices.${source}`]).toContain("elige 2 tipos de daño.");
    expect((await errorsOf(sheet, boon(["banana", "fire"])))[`choices.${source}`]).toContain("tipo de daño no válido.");
    // «force» existe pero no está en la lista de la dote; repetir uno tampoco vale
    expect(await errorsOf(sheet, boon(["force", "fire"]))).toHaveProperty([`choices.${source}`]);
    expect(await errorsOf(sheet, boon(["fire", "fire"]))).toHaveProperty([`choices.${source}`]);
  });

  it("dote con resistencia a elegir en lugar de la mejora: guarda el tipo y llega a derive", async () => {
    const warded = (resist?: unknown) => ({ feat: client("feat:warded|xphb"), ability: "str", ...(resist ? { resist } : {}) });
    const r = await validateLevel(barbarian3(), input({ choices: [asi(warded(["poison"])), mastery()] }), ctx());
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.entry.choices[0]).toMatchObject({ type: "asi", value: { feat: { name: "Warded" }, ability: "str", resist: ["poison"] } });
    expect(await errorsOf(barbarian3(), input({ choices: [asi(warded()), mastery()] }))).toHaveProperty([`choices.${ASI}`]);
    // Una dote sin esa elección ignora el campo
    const gwm = { feat: client("feat:great weapon master|xphb"), ability: "str", resist: ["fire"] };
    const ok = await validateLevel(barbarian3(), input({ choices: [asi(gwm), mastery()] }), ctx());
    if (!ok.ok) throw new Error(JSON.stringify(ok.errors));
    expect(ok.entry.choices[0]).not.toHaveProperty("value.resist");
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

describe("rasgos de conjuro de nivel alto", () => {
  describe("Secretos mágicos (Bardo 10)", () => {
    const SPELLS = "progression:spells|bard|xphb";
    // Bardo 9 → 10: un truco y un conjuro nuevos
    const body = (cantrip: string, spell: string, extraValue: object = {}) => ({
      expectedLevel: 10, class: client("class:bard|xphb"), hp: { method: "average", value: 5 },
      choices: [{
        type: "spells", source: SPELLS,
        value: { cantrips: [client(`spell:${cantrip}|xphb`)], spells: [client(`spell:${spell}|xphb`)], ...extraValue },
      }],
    });

    it("Bardo 10: acepta un conjuro de la lista del Mago (cuenta como de Bardo)", async () => {
      const r = await validateLevel(sheetWith([["bard", 9]]), body("vicious mockery", "magic missile"), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.choices[0].value).toMatchObject({ spells: [{ name: "magic missile" }] });
    });
    it("Bardo 10: también al sustituir un conjuro; los trucos siguen siendo solo de Bardo", async () => {
      const s = sheetWith([["bard", 9]], {
        1: [{ type: "spells", source: SPELLS, value: { class: cls("bard"), cantrips: [], spells: [named(ref("spell:healing word|xphb"))] } }],
      });
      const replace = { out: client("spell:healing word|xphb"), in: client("spell:shield|xphb") };
      const r = await validateLevel(s, body("vicious mockery", "magic missile", { replace }), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(await errorsOf(sheetWith([["bard", 9]]), body("light", "magic missile")))
        .toEqual({ [`choices.${SPELLS}`]: "Conjuros: light no está en la lista de la clase." });
    });
    it("Bardo 9: un conjuro de la lista del Mago → error", async () => {
      const errors = await errorsOf(sheetWith([["bard", 8]]), {
        expectedLevel: 9, class: client("class:bard|xphb"), hp: { method: "average", value: 5 },
        choices: [{ type: "spells", source: SPELLS, value: { cantrips: [], spells: [client("spell:magic missile|xphb"), client("spell:healing word|xphb")] } }],
      });
      expect(errors[`choices.${SPELLS}`]).toBe("Conjuros: magic missile no está en la lista de la clase.");
    });
  });

  describe("Arcano místico (Brujo 11, 13…)", () => {
    const ARCANUM = (n: number) => `classFeature:mystic arcanum|warlock|xphb|${n}`;
    const SPELLS = "progression:spells|warlock|xphb";
    // Brujo n-1 → n: un conjuro aprendido nuevo y el arcano
    const body = (n: number, arcanum: string, spell = "hex") => ({
      expectedLevel: n, class: client("class:warlock|xphb"), hp: { method: "average", value: 5 },
      choices: [
        { type: "arcanum", source: ARCANUM(n), value: client(`spell:${arcanum}|xphb`) },
        { type: "spells", source: SPELLS, value: { cantrips: [], spells: [client(`spell:${spell}|xphb`)] } },
      ],
    });

    it("Brujo 11: un conjuro de Brujo de nivel 6, con el nombre del catálogo", async () => {
      const r = await validateLevel(sheetWith([["warlock", 10]]), body(11, "circle of death"), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.choices.find((c) => c.type === "arcanum")).toEqual({
        type: "arcanum", source: ARCANUM(11), value: { ref: ref("spell:circle of death|xphb"), name: "circle of death" },
      });
    });
    it("de otro nivel, de otra lista, que falta o que no es un conjuro → error", async () => {
      const arcanumError = async (spell: string) =>
        (await errorsOf(sheetWith([["warlock", 10]]), body(11, spell)))[`choices.${ARCANUM(11)}`];
      expect(await arcanumError("finger of death")).toBe("Arcano místico: finger of death no es un conjuro de nivel 6.");
      expect(await arcanumError("chain lightning")).toBe("Arcano místico: chain lightning no está en la lista de la clase.");
      expect(await arcanumError("nada")).toBe("Arcano místico: elige un conjuro.");
      const missing = { ...body(11, "circle of death"), choices: [body(11, "circle of death").choices[1]] };
      expect(await errorsOf(sheetWith([["warlock", 10]]), missing)).toHaveProperty("choices", "Falta elegir: Arcano místico.");
    });
    it("Brujo 13: pide uno de nivel 7", async () => {
      const s = sheetWith([["warlock", 12]], { 11: [{ type: "arcanum", source: ARCANUM(11), value: named(ref("spell:circle of death|xphb")) }] });
      const r = await validateLevel(s, body(13, "finger of death"), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(await errorsOf(s, body(13, "circle of death"))).toHaveProperty(
        [`choices.${ARCANUM(13)}`], "Arcano místico: circle of death no es un conjuro de nivel 7.",
      );
    });
  });
});

describe("conjuros extra del Bardo del Saber y del Mago", () => {
  // Conjuros con escuela: nombre, nivel, escuela y listas
  for (const [name, level, school, classes] of [
    ["alarm", 1, "A", ["wizard", "ranger"]], ["arcane lock", 2, "A", ["wizard"]], ["counterspell", 3, "A", ["sorcerer", "warlock", "wizard"]],
    ["silent image", 1, "I", ["bard", "sorcerer", "wizard"]], ["mirror image", 2, "I", ["sorcerer", "warlock", "wizard"]],
    ["fireball", 3, "V", ["sorcerer", "wizard"]], ["lightning bolt", 3, "V", ["sorcerer", "wizard"]],
    ["cure wounds", 1, "A", ["bard", "cleric", "druid"]], ["aid", 2, "A", ["bard", "cleric"]],
    ["guardian of faith", 4, "C", ["cleric"]], ["spirit guardians", 3, "C", ["cleric"]], ["goodberry", 1, "C", ["druid"]],
    ["eyebite", 6, "N", ["bard", "sorcerer", "warlock", "wizard"]],
  ] as [string, number, string, string[]][]) {
    extra(`spell:${name}|xphb`, {
      level, school, time: "", range: "", components: "", duration: "", concentration: false, ritual: false, classes, tags: [],
    }, name);
  }
  const spell = (name: string) => client(`spell:${name}|xphb`);
  const held = (name: string) => named(ref(`spell:${name}|xphb`));
  const hp = { method: "average", value: 5 };
  const hpWizard = { method: "average", value: 4 };
  const subclass = (key: string): Choice => ({ type: "subclass", source: "class:subclass", value: named(ref(key)) });
  const spellsChoice = (cls: string, cantrips: string[], spells: string[]): Choice =>
    ({ type: "spells", source: `progression:spells|${cls}|xphb`, value: { class: ref(`class:${cls}|xphb`), cantrips: cantrips.map(held), spells: spells.map(held) } });

  describe("Descubrimientos mágicos (Saber 6)", () => {
    const SOURCE = "subclassFeature:magical discoveries|bard|xphb|lore|xphb|6";
    const LORE = subclass("subclass:college of lore|bard|xphb");
    const bard = (n: number, extraChoices: Record<number, Choice[]> = {}) =>
      sheetWith([["bard", n]], { 1: [spellsChoice("bard", ["vicious mockery"], ["healing word"])], 3: [LORE], ...extraChoices });
    const body = (n: number, bonus: unknown, spellName = "silent image") => ({
      expectedLevel: n, class: client("class:bard|xphb"), hp,
      choices: [
        { type: "spells", source: "progression:spells|bard|xphb", value: { cantrips: [], spells: [spell(spellName)] } },
        ...(bonus === undefined ? [] : [{ type: "bonusSpells", source: SOURCE, value: bonus }]),
      ],
    });
    const errorOf = async (n: number, bonus: unknown, sheet = bard(n - 1)) =>
      (await errorsOf(sheet, body(n, bonus)))[`choices.${SOURCE}`];

    it("Saber 6: 2 de Clérigo, Druida o Mago (un truco y un conjuro de nivel 3), con los nombres del catálogo", async () => {
      const r = await validateLevel(bard(5), body(6, { spells: [spell("light"), spell("spirit guardians")] }), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.choices.at(-1)).toEqual({
        type: "bonusSpells", source: SOURCE, value: { spells: [held("light"), held("spirit guardians")] },
      });
    });
    it("de un nivel sin espacios, de otra lista, que ya tiene, repetido o en número distinto de 2 → error", async () => {
      expect(await errorOf(6, { spells: [spell("light"), spell("guardian of faith")] }))
        .toBe("Descubrimientos mágicos: guardian of faith es de nivel 4; el máximo es 3.");
      expect(await errorOf(6, { spells: [spell("light"), spell("vicious mockery")] }))
        .toBe("Descubrimientos mágicos: vicious mockery no está en una lista permitida.");
      expect(await errorOf(6, { spells: [spell("light"), spell("healing word")] })).toBe("Descubrimientos mágicos: ya tienes healing word.");
      expect(await errorOf(6, { spells: [spell("light"), spell("silent image")] })).toBe("Descubrimientos mágicos: ya tienes silent image.");
      expect(await errorOf(6, { spells: [spell("light"), spell("light")] })).toBe("Descubrimientos mágicos: ya tienes light.");
      expect(await errorOf(6, { spells: [spell("light")] })).toBe("Descubrimientos mágicos: elige 2 conjuros.");
      expect(await errorsOf(bard(5), body(6, undefined))).toHaveProperty("choices", "Falta elegir: Descubrimientos mágicos.");
    });
    it("Bardo 7: puede sustituir uno por otro que cumpla lo mismo (con el nivel máximo del 7); sin sustituir, nada", async () => {
      const lore6 = bard(6, { 6: [{ type: "bonusSpells", source: SOURCE, value: { spells: [held("light"), held("goodberry")] } }] });
      const r = await validateLevel(lore6, body(7, { spells: [], replace: { out: spell("goodberry"), in: spell("guardian of faith") } }), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.choices.at(-1)).toEqual({
        type: "bonusSpells", source: SOURCE, value: { spells: [], replace: { out: held("goodberry"), in: held("guardian of faith") } },
      });
      expect(await errorsOf(lore6, body(7, undefined))).toEqual({});
      expect(await errorOf(7, { spells: [], replace: { out: spell("bless"), in: spell("aid") } }, lore6))
        .toBe("Descubrimientos mágicos: solo puedes sustituir uno que ya tienes.");
      expect(await errorOf(7, { spells: [], replace: { out: spell("goodberry"), in: spell("light") } }, lore6))
        .toBe("Descubrimientos mágicos: ya tienes light.");
      expect(await errorOf(7, { spells: [] }, lore6)).toBe("Descubrimientos mágicos: elige el conjuro que sustituyes.");
      // En el 6 no hay nada que sustituir
      expect(await errorOf(6, { spells: [spell("light"), spell("aid")], replace: { out: spell("light"), in: spell("bless") } }))
        .toBe("Descubrimientos mágicos: no puedes sustituir conjuros en este nivel.");
    });
  });

  describe("Sabio de la escuela e Ilusiones mejoradas (Mago 3)", () => {
    const SPELLS = "progression:spells|wizard|xphb";
    const IMPROVED = "subclassFeature:improved illusions|wizard|xphb|illusionist|xphb|3";
    const wizard2 = (cantrips = ["light"]) => sheetWith([["wizard", 2]], { 1: [spellsChoice("wizard", cantrips, ["magic missile"])] });
    const body = (sub: string, free: string[], more: unknown[] = []) => ({
      expectedLevel: 3, class: client("class:wizard|xphb"), hp: hpWizard,
      choices: [
        { type: "subclass", source: "class:subclass", value: client(`subclass:${sub}|wizard|xphb`) },
        { type: "spells", source: SPELLS, value: { cantrips: [], spells: [spell("shield"), spell("burning hands")], free: free.map(spell) } },
        ...more,
      ],
    });

    it("Abjurador 3: 2 gratis de Abjuración de nivel 1 o 2 que entran en el libro", async () => {
      const r = await validateLevel(wizard2(), body("abjurer", ["alarm", "arcane lock"]), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.choices.find((c) => c.type === "spells")?.value).toMatchObject({ free: [held("alarm"), held("arcane lock")] });
    });
    it("los gratis son opcionales: de 0 a 2", async () => {
      expect(await errorsOf(wizard2(), body("abjurer", ["alarm"]))).toEqual({});
      expect(await errorsOf(wizard2(), body("abjurer", []))).toEqual({});
      const r = await validateLevel(wizard2(), body("abjurer", []), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.choices.find((c) => c.type === "spells")?.value).toMatchObject({ free: [] });
    });
    it("de otra escuela, de nivel 3, repetido o más de 2 → error", async () => {
      const freeError = async (free: string[]) => (await errorsOf(wizard2(), body("abjurer", free)))[`choices.${SPELLS}`];
      expect(await freeError(["alarm", "silent image"])).toBe("Conjuros: silent image no es de Abjuración.");
      expect(await freeError(["alarm", "counterspell"])).toBe("Conjuros: counterspell no es un conjuro de nivel 1 a 2.");
      expect(await freeError(["alarm", "alarm"])).toBe("Conjuros: conjuro repetido.");
      expect(await freeError(["alarm", "arcane lock", "shield"])).toBe("Conjuros: elige hasta 2 conjuros gratis de Abjuración.");
    });
    it("Abjurador 5 (espacios de nivel 3): 1 gratis de hasta nivel 3", async () => {
      // (con las 2 gratis del nivel 3 ya elegidas)
      const free3: Choice = { type: "spells", source: SPELLS, value: { class: ref("class:wizard|xphb"), cantrips: [], spells: [], free: [held("alarm"), held("protection from evil and good")] } };
      const s = sheetWith([["wizard", 4]], { 1: [spellsChoice("wizard", ["light"], ["magic missile"])], 3: [subclass("subclass:abjurer|wizard|xphb"), free3] });
      const body5 = (free: string[]) => ({
        expectedLevel: 5, class: client("class:wizard|xphb"), hp: hpWizard,
        choices: [{ type: "spells", source: SPELLS, value: { cantrips: [], spells: [spell("shield"), spell("fireball")], free: free.map(spell) } }],
      });
      expect(await errorsOf(s, body5(["counterspell"]))).toEqual({});
      expect((await errorsOf(s, body5(["alarm", "counterspell"])))[`choices.${SPELLS}`]).toBe("Conjuros: elige hasta 1 conjuro gratis de Abjuración.");
    });
    it("Ilusionista 3 sin Ilusión menor: la recibe sin elegir (no pide truco)", async () => {
      const r = await validateLevel(wizard2(), body("illusionist", ["silent image", "mirror image"]), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      const bonus = { type: "bonusSpells", source: IMPROVED, value: { spells: [spell("chill touch")] } };
      expect(await errorsOf(wizard2(), body("illusionist", ["silent image", "mirror image"], [bonus])))
        .toHaveProperty("choices", "Hay elecciones que este nivel no pide.");
    });
    it("Ilusionista 3 que ya conoce Ilusión menor: pide 1 truco de Mago que no tenga", async () => {
      const knows = wizard2(["light", "minor illusion"]);
      const withBonus = (name: string) => body("illusionist", ["silent image", "mirror image"],
        [{ type: "bonusSpells", source: IMPROVED, value: { spells: [spell(name)] } }]);
      const r = await validateLevel(knows, withBonus("chill touch"), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.choices.at(-1)).toEqual({ type: "bonusSpells", source: IMPROVED, value: { spells: [held("chill touch")] } });
      const bonusError = async (name: string) => (await errorsOf(knows, withBonus(name)))[`choices.${IMPROVED}`];
      expect(await bonusError("magic missile")).toBe("Ilusiones mejoradas: magic missile no es un truco.");
      expect(await bonusError("minor illusion")).toBe("Ilusiones mejoradas: ya tienes minor illusion.");
      expect(await bonusError("sacred flame")).toBe("Ilusiones mejoradas: sacred flame no está en una lista permitida.");
      expect(await errorsOf(knows, body("illusionist", ["silent image", "mirror image"])))
        .toHaveProperty("choices", "Falta elegir: Ilusiones mejoradas.");
    });
  });

  describe("Conjuros distintivos (Mago 20)", () => {
    const SOURCE = "classFeature:signature spells|wizard|xphb|20";
    const wizard19 = () => sheetWith([["wizard", 19]], { 1: [spellsChoice("wizard", ["light"], ["magic missile", "fireball", "lightning bolt"])] });
    const body = (names: string[], bookEntries = ["shield", "counterspell"]) => ({
      expectedLevel: 20, class: client("class:wizard|xphb"), hp: hpWizard,
      choices: [
        { type: "spells", source: "progression:spells|wizard|xphb", value: { cantrips: [], spells: bookEntries.map(spell) } },
        { type: "bonusSpells", source: SOURCE, value: { spells: names.map(spell) } },
      ],
    });
    const errorOf = async (names: string[]) => (await errorsOf(wizard19(), body(names)))[`choices.${SOURCE}`];

    it("2 de nivel 3 de su libro (también los que entran en él en este nivel)", async () => {
      const r = await validateLevel(wizard19(), body(["fireball", "counterspell"]), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.choices.at(-1)).toEqual({ type: "bonusSpells", source: SOURCE, value: { spells: [held("fireball"), held("counterspell")] } });
    });
    it("de otro nivel, fuera del libro o repetido → error", async () => {
      expect(await errorOf(["fireball", "magic missile"])).toBe("Conjuros distintivos: magic missile no es un conjuro de nivel 3.");
      const r = await errorsOf(wizard19(), body(["fireball", "lightning bolt"], ["shield", "alarm"]));
      expect(r).toEqual({});
      expect((await errorsOf(wizard19(), body(["fireball", "counterspell"], ["shield", "alarm"])))[`choices.${SOURCE}`])
        .toBe("Conjuros distintivos: counterspell no está en tu libro de conjuros.");
      expect(await errorOf(["fireball", "fireball"])).toBe("Conjuros distintivos: ya tienes fireball.");
    });
  });

  describe("Arcano místico: sustitución desde Brujo 12", () => {
    const ARCANUM = (n: number) => `classFeature:mystic arcanum|warlock|xphb|${n}`;
    const warlock13 = () => sheetWith([["warlock", 13]], {
      11: [{ type: "arcanum", source: ARCANUM(11), value: held("circle of death") }],
      13: [{ type: "arcanum", source: ARCANUM(13), value: held("finger of death") }],
    });
    const body = (choice?: Record<string, unknown>) => ({
      expectedLevel: 14, class: client("class:warlock|xphb"), hp,
      choices: choice ? [{ type: "arcanum", source: ARCANUM(13), value: null, ...choice }] : [],
    });
    const errorOf = async (choice: Record<string, unknown>) => (await errorsOf(warlock13(), body(choice)))[`choices.${ARCANUM(13)}`];

    it("Brujo 14: sin sustituir, nada; sustituye uno por otro de Brujo del mismo nivel", async () => {
      expect(await errorsOf(warlock13(), body())).toEqual({});
      const replace = { out: spell("circle of death"), in: spell("eyebite") };
      const r = await validateLevel(warlock13(), body({ replace }), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.choices).toEqual([{
        type: "arcanum", source: ARCANUM(13), value: null, replace: { out: held("circle of death"), in: held("eyebite") },
      }]);
    });
    it("de otro nivel, de otra lista, uno que no tiene, uno que ya tiene o con un arcano nuevo → error", async () => {
      expect(await errorOf({ replace: { out: spell("circle of death"), in: spell("finger of death") } }))
        .toBe("Arcano místico: finger of death no es un conjuro de nivel 6.");
      expect(await errorOf({ replace: { out: spell("circle of death"), in: spell("chain lightning") } }))
        .toBe("Arcano místico: chain lightning no está en la lista de la clase.");
      expect(await errorOf({ replace: { out: spell("eyebite"), in: spell("circle of death") } }))
        .toBe("Arcano místico: solo puedes sustituir uno que ya tienes.");
      expect(await errorOf({ replace: { out: spell("circle of death"), in: spell("circle of death") } }))
        .toBe("Arcano místico: ya tienes circle of death.");
      expect(await errorOf({ value: spell("eyebite") })).toBe("Arcano místico: en este nivel solo puedes sustituir un arcano.");
      expect(await errorOf({})).toBe("Arcano místico: elige el arcano que sustituyes.");
    });
    it("Brujo 13: el arcano nuevo y, a la vez, la sustitución de uno de nivel 6", async () => {
      const s = sheetWith([["warlock", 12]], { 11: [{ type: "arcanum", source: ARCANUM(11), value: held("circle of death") }] });
      const r = await validateLevel(s, {
        expectedLevel: 13, class: client("class:warlock|xphb"), hp,
        choices: [
          { type: "arcanum", source: ARCANUM(13), value: spell("finger of death"), replace: { out: spell("circle of death"), in: spell("eyebite") } },
          { type: "spells", source: "progression:spells|warlock|xphb", value: { cantrips: [], spells: [spell("hex")] } },
        ],
      }, ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.choices[0]).toEqual({
        type: "arcanum", source: ARCANUM(13), value: held("finger of death"), replace: { out: held("circle of death"), in: held("eyebite") },
      });
    });
    it("hoja de antes del rasgo (Brujo 12 sin arcanos) que sube a 13: pide el de nivel 6 y el de nivel 7", async () => {
      const s = sheetWith([["warlock", 12]]);
      const choices = (arcana: [number, string][]) => ({
        expectedLevel: 13, class: client("class:warlock|xphb"), hp,
        choices: [
          ...arcana.map(([n, name]) => ({ type: "arcanum", source: ARCANUM(n), value: spell(name) })),
          { type: "spells", source: "progression:spells|warlock|xphb", value: { cantrips: [], spells: [spell("hex")] } },
        ],
      });
      const r = await validateLevel(s, choices([[11, "circle of death"], [13, "finger of death"]]), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.choices.filter((c) => c.type === "arcanum")).toEqual([
        { type: "arcanum", source: ARCANUM(11), value: held("circle of death") },
        { type: "arcanum", source: ARCANUM(13), value: held("finger of death") },
      ]);
      expect(await errorsOf(s, choices([[13, "finger of death"]]))).toHaveProperty("choices", "Falta elegir: Arcano místico (nivel 6).");
      expect((await errorsOf(s, choices([[11, "finger of death"], [13, "circle of death"]])))[`choices.${ARCANUM(11)}`])
        .toBe("Arcano místico (nivel 6): finger of death no es un conjuro de nivel 6.");
    });
  });
});

describe("dotes y Pacto del tomo", () => {
  // Conjuros de prueba: nombre, nivel, listas y si es ritual
  for (const [name, level, classes, ritual] of [
    ["druidcraft", 0, ["druid"], false], ["produce flame", 0, ["druid"], false], ["entangle", 1, ["druid"], false],
    ["prayer of healing", 2, ["cleric"], false], ["find familiar", 1, ["wizard"], true],
    ["speak with animals", 1, ["bard", "druid", "ranger"], true],
  ] as [string, number, string[], boolean][]) {
    extra(`spell:${name}|xphb`, {
      level, school: "V", time: "", range: "", components: "", duration: "", concentration: false, ritual, classes, tags: [],
    }, name);
  }
  extra("optionalFeature:pact of the tome|xphb", {
    featureType: ["EI"],
    spellChoices: [{ level: 1, count: 3, filter: { level: 0 } }, { level: 1, count: 2, filter: { level: 1, ritual: true } }],
  }, "Pact of the Tome");
  // Trasfondo de prueba con la dote base de Iniciado en la magia (tres listas a elegir)
  const acolyte = cat.get(`${B}:background:acolyte|xphb`)!;
  extra("background:initiate|xphb", { ...(acolyte.data as object), feat: ref("feat:magic initiate|xphb") }, "Initiate");
  const spell = (name: string) => client(`spell:${name}|xphb`);
  const held = (name: string) => named(ref(`spell:${name}|xphb`));
  const featSpells = (source: string, value: object) => ({ type: "featSpells", source, value });

  describe("Pacto del tomo (Brujo 2)", () => {
    const TOME = "featSpells:optionalFeature:pact of the tome|xphb";
    const PACT = client("optionalFeature:pact of the tome|xphb");
    const warlock1 = () => sheetWith([["warlock", 1]], {
      1: [{ type: "optionalFeature", source: INVOCATIONS, value: [named(ref("optionalFeature:armor of shadows|xphb"))] }],
    });
    const learn = { type: "spells", source: "progression:spells|warlock|xphb", value: { cantrips: [], spells: [spell("hex")] } };
    const body = (invocations: unknown[], extraChoices: unknown[] = []) => ({
      expectedLevel: 2, class: client("class:warlock|xphb"), hp: { method: "average", value: 5 },
      choices: [{ type: "optionalFeature", source: INVOCATIONS, value: invocations }, learn, ...extraChoices],
    });
    const tome = (rituals: string[]) => featSpells(TOME, {
      cantrips: ["sacred flame", "vicious mockery", "druidcraft"].map(spell), spells: rituals.map(spell),
    });
    const withTome = (extraChoices: unknown[]) =>
      body([PACT, client("optionalFeature:misty visions|xphb")], extraChoices);

    it("3 trucos y 2 rituales de nivel 1 de cualquier lista, con la invocación como dote", async () => {
      const r = await validateLevel(warlock1(), withTome([tome(["find familiar", "speak with animals"])]), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.choices.at(-1)).toEqual({
        type: "featSpells", source: TOME, value: {
          feat: ref("optionalFeature:pact of the tome|xphb"),
          cantrips: [held("sacred flame"), held("vicious mockery"), held("druidcraft")],
          spells: [held("find familiar"), held("speak with animals")],
        },
      });
    });
    it("un conjuro que no es ritual o sin elegirlos → error", async () => {
      expect(await errorsOf(warlock1(), withTome([tome(["find familiar", "bless"])])))
        .toHaveProperty([`choices.${TOME}`], "Conjuros de Pact of the Tome: bless no se puede elegir con esta dote.");
      expect(await errorsOf(warlock1(), withTome([]))).toHaveProperty("choices", "Falta elegir: Conjuros de Pact of the Tome.");
    });
    it("el mismo truco con el Pacto del tomo y con otra dote en el mismo nivel → error en la segunda", async () => {
      extra("spell:guidance|xphb", {
        level: 0, school: "V", time: "", range: "", components: "", duration: "", concentration: false, ritual: false,
        classes: ["cleric"], tags: [],
      }, "guidance");
      const INITIATE = "featSpells:feat:magic initiate; cleric|xphb";
      const s = warlock1();
      s.levels[0].choices.push({
        type: "featSpells", source: INITIATE, value: {
          feat: ref("feat:magic initiate; cleric|xphb"), cantrips: [held("light"), held("sacred flame")], spells: [held("bless")],
          ability: "wis",
        },
      });
      const swap = featSpells(INITIATE, { cantrips: [], spells: [], replace: { out: spell("sacred flame"), in: spell("guidance") } });
      const clashing = { ...tome(["find familiar", "speak with animals"]), value: {
        cantrips: ["guidance", "vicious mockery", "druidcraft"].map(spell), spells: ["find familiar", "speak with animals"].map(spell),
      } };
      const errors = await errorsOf(s, withTome([swap, clashing]));
      // Choca la que va después en el orden del nivel (la dote que ya tenía, tras la invocación que gana); la otra no tiene error
      expect(errors).toEqual({
        [`choices.${INITIATE}`]: "Conjuros de Magic Initiate; Cleric: guidance ya lo eliges con Pact of the Tome.",
      });
    });
    it("si ya tenía el Pacto del tomo sin sus conjuros (hoja anterior), se piden en la siguiente subida", async () => {
      const s = sheetWith([["warlock", 1]], {
        1: [{ type: "optionalFeature", source: INVOCATIONS, value: [named(ref("optionalFeature:pact of the tome|xphb"))] }],
      });
      const two = [client("optionalFeature:mask of many faces|xphb"), client("optionalFeature:misty visions|xphb")];
      expect(await errorsOf(s, body(two))).toHaveProperty("choices", "Falta elegir: Conjuros de Pact of the Tome.");
      expect(await errorsOf(s, body(two, [tome(["find familiar", "speak with animals"])]))).toEqual({});
    });
  });

  describe("Iniciado en la magia", () => {
    const INITIATE = "featSpells:feat:magic initiate; cleric|xphb";
    const BASE = "featSpells:feat:magic initiate|xphb";
    // Bárbaro 3 con el Acólito y los conjuros de su dote ya elegidos
    const withInitiate = () => {
      const s = barbarian3();
      s.levels[0].choices.push({
        type: "featSpells", source: INITIATE, value: {
          feat: ref("feat:magic initiate; cleric|xphb"), cantrips: [held("light"), held("sacred flame")], spells: [held("bless")],
          ability: "wis",
        },
      });
      return s;
    };
    const levelUp = (extraChoice: unknown) => input({ choices: [asi({ abilities: { str: 2 } }), mastery(), extraChoice] });
    const swap = (source: string, out: string, into: string) =>
      featSpells(source, { cantrips: [], spells: [], replace: { out: spell(out), in: spell(into) } });

    it("al subir puede cambiar uno de sus conjuros por otro de la misma lista y nivel", async () => {
      const r = await validateLevel(withInitiate(), levelUp(swap(INITIATE, "bless", "command")), ctx());
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      expect(r.entry.choices.at(-1)).toEqual({
        type: "featSpells", source: INITIATE, value: {
          feat: ref("feat:magic initiate; cleric|xphb"), cantrips: [], spells: [],
          replace: { out: held("bless"), in: { ref: ref("spell:command|xphb"), name: "Command" } },
        },
      });
      // Es opcional
      expect(await errorsOf(withInitiate(), input())).toEqual({});
    });
    it("de otro nivel, de otra lista, uno que no tiene o uno que ya tiene → error", async () => {
      const swapError = async (out: string, into: string) =>
        (await errorsOf(withInitiate(), levelUp(swap(INITIATE, out, into))))[`choices.${INITIATE}`];
      const LABEL = "Conjuros de Magic Initiate; Cleric";
      expect(await swapError("bless", "prayer of healing")).toBe(`${LABEL}: prayer of healing no es un conjuro de nivel 1.`);
      expect(await swapError("bless", "magic missile")).toBe(`${LABEL}: magic missile no se puede elegir con esta dote.`);
      expect(await swapError("command", "bless")).toBe(`${LABEL}: solo puedes cambiar uno de los conjuros de la dote.`);
      expect(await swapError("sacred flame", "light")).toBe(`${LABEL}: ya tienes light.`);
      // Sin conjuros elegidos con la dote no hay nada que cambiar
      expect(await errorsOf(barbarian3(), levelUp(swap(INITIATE, "bless", "command"))))
        .toHaveProperty("choices", "Hay elecciones que este nivel no pide.");
    });

    describe("dote base (lista a elegir)", () => {
      // Hoja anterior con la dote base y sin sus conjuros: se piden en la siguiente subida
      const initiate3 = () => {
        const s = barbarian3();
        s.background = { ...named(ref("background:initiate|xphb")), abilities: { wis: 2, int: 1 }, equipment: "A" };
        return s;
      };
      const druid = { cantrips: [spell("druidcraft"), spell("produce flame")], spells: [spell("entangle")], ability: "wis" };
      const LABEL = "Conjuros de Magic Initiate";

      it("sin lista, con una lista que no ofrece o con un conjuro de otra lista → error", async () => {
        const pickError = async (value: object) => (await errorsOf(initiate3(), levelUp(featSpells(BASE, value))))[`choices.${BASE}`];
        expect(await pickError(druid)).toBe(`${LABEL}: elige la lista de conjuros.`);
        expect(await pickError({ ...druid, list: "bard" })).toBe(`${LABEL}: elige la lista de conjuros.`);
        expect(await pickError({ ...druid, list: "druid", spells: [spell("magic missile")] }))
          .toBe(`${LABEL}: magic missile no se puede elegir con esta dote.`);
        expect(await errorsOf(initiate3(), input())).toHaveProperty("choices", `Falta elegir: ${LABEL}.`);
      });
      it("con la lista elegida: la guarda", async () => {
        const r = await validateLevel(initiate3(), levelUp(featSpells(BASE, { ...druid, list: "druid" })), ctx());
        if (!r.ok) throw new Error(JSON.stringify(r.errors));
        expect(r.entry.choices.at(-1)).toEqual({
          type: "featSpells", source: BASE, value: {
            feat: ref("feat:magic initiate|xphb"), list: "druid",
            cantrips: [held("druidcraft"), held("produce flame")], spells: [held("entangle")], ability: "wis",
          },
        });
      });
      it("después, el cambio de un conjuro es de su lista", async () => {
        const s = initiate3();
        s.levels[2].choices.push({
          type: "featSpells", source: BASE, value: {
            feat: ref("feat:magic initiate|xphb"), list: "druid", cantrips: [held("druidcraft"), held("produce flame")],
            spells: [held("entangle")], ability: "wis",
          },
        });
        expect(await errorsOf(s, levelUp(swap(BASE, "entangle", "speak with animals")))).toEqual({});
        expect((await errorsOf(s, levelUp(swap(BASE, "entangle", "bless"))))[`choices.${BASE}`])
          .toBe(`${LABEL}: bless no se puede elegir con esta dote.`);
      });
    });
  });

  it("un multiclase puede aprender como Bardo un conjuro que su subclase de Clérigo le da siempre preparado", async () => {
    const LIFE = named(ref("subclass:life domain|cleric|xphb"));
    const bardSpells = (spells: Choice["value"]) => ({ type: "spells", source: "progression:spells|bard|xphb", value: spells });
    const s = sheetWith([["bard", 1], ["cleric", 3]], {
      1: [
        { type: "skills", source: "class:skills", value: ["arcana", "history", "performance"] },
        bardSpells({ class: cls("bard"), cantrips: [held("vicious mockery")], spells: [held("healing word")] }) as Choice,
      ],
      4: [{ type: "subclass", source: "class:subclass", value: LIFE }],
    });
    const r = await validateLevel(s, {
      expectedLevel: 5, class: client("class:bard|xphb"), hp: { method: "average", value: 5 },
      choices: [
        { type: "expertise", source: "classFeature:expertise|bard|xphb|2", value: ["arcana", "history"] },
        bardSpells({ cantrips: [], spells: [spell("cure wounds")] } as Choice["value"]),
      ],
    }, ctx());
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.entry.choices.at(-1)).toMatchObject({ value: { spells: [{ name: "cure wounds" }] } });
  });
});
