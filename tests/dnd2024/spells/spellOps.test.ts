import { describe, expect, it } from "vitest";
import { derive } from "@/lib/rules/dnd2024/derive";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { Choice, Dnd2024SheetV2, LevelEntry, Named } from "@/lib/rules/dnd2024/sheet/sheet";
import { removeLastLevel } from "@/lib/rules/dnd2024/levels/levelOps";
import { applySpellOp, trimSpells } from "@/lib/rules/dnd2024/spells/spellOps";
import type { Ref, SpellData } from "@/lib/rules/types";
import { B, buildCatalog, ref } from "../fixtureCatalog";

const entries = buildCatalog(["class-cleric.json", "class-wizard.json", "class-sorcerer.json", "class-warlock.json", "class-druid.json", "class-bard.json"]);

// Conjuros de prueba: nombre, nivel y listas
const SPELLS: [string, number, string[]][] = [
  ["bless", 1, ["cleric", "paladin"]],
  ["cure wounds", 1, ["cleric", "druid"]],
  ["guiding bolt", 1, ["cleric"]],
  ["healing word", 1, ["cleric", "bard"]],
  ["sanctuary", 1, ["cleric"]],
  ["command", 1, ["cleric"]],
  ["aid", 2, ["cleric"]],
  ["spirit guardians", 3, ["cleric"]],
  ["magic missile", 1, ["wizard", "sorcerer"]],
  ["shield", 1, ["wizard", "sorcerer"]],
  ["sleep", 1, ["wizard"]],
  ["mage armor", 1, ["wizard", "sorcerer"]],
  ["detect magic", 1, ["wizard", "cleric"]],
  ["burning hands", 1, ["wizard", "sorcerer"]],
  ["grease", 1, ["wizard"]],
  ["light", 0, ["wizard", "cleric", "sorcerer"]],
  ["fog cloud", 1, ["druid", "wizard"]],
  ["entangle", 1, ["druid"]],
  ["goodberry", 1, ["druid"]],
  ["thunderwave", 1, ["druid", "wizard"]],
  ["faerie fire", 1, ["druid"]],
  ["jump", 1, ["druid"]],
  ["vicious mockery", 0, ["bard"]],
  ["circle of death", 6, ["sorcerer", "warlock", "wizard"]],
];
for (const [name, level, classes] of SPELLS) {
  const data: SpellData = {
    level, school: "V", time: "", range: "", components: "", duration: "", concentration: false, ritual: false,
    classes, tags: [],
  };
  entries.set(`${B}:spell:${name}|xphb`, {
    ref: ref(`spell:${name}|xphb`), name, nameEs: null, bookName: "Libro", srd52: true, data, description: "",
    descriptionEs: "", identifier: name, parent: null, foundry: null,
  });
}
const spell = (name: string): Named => ({ ref: ref(`spell:${name}|xphb`), name });
const CLASSES: Record<string, Named> = {
  cleric: { ref: ref("class:cleric|xphb"), name: "Clérigo" },
  wizard: { ref: ref("class:wizard|xphb"), name: "Mago" },
  sorcerer: { ref: ref("class:sorcerer|xphb"), name: "Hechicero" },
  warlock: { ref: ref("class:warlock|xphb"), name: "Brujo" },
  druid: { ref: ref("class:druid|xphb"), name: "Druida" },
  bard: { ref: ref("class:bard|xphb"), name: "Bardo" },
};
const BOOK = ["magic missile", "shield", "sleep", "mage armor", "detect magic", "burning hands"].map(spell);

function sheetOf(path: string[], choices: Record<number, Choice[]> = {}): Dnd2024SheetV2 {
  const count = new Map<string, number>();
  const levels: LevelEntry[] = path.map((id, i) => {
    count.set(id, (count.get(id) ?? 0) + 1);
    return { n: i + 1, class: CLASSES[id], classLevel: count.get(id)!, hp: { method: "average", value: 5 }, choices: choices[i + 1] ?? [] };
  });
  return {
    version: 2,
    species: { ref: ref("species:elf|xphb"), name: "Elfo" },
    lineage: null,
    background: { ref: ref("background:none|xphb"), name: "Ninguno", abilities: {}, equipment: "A" },
    abilityMethod: "standard",
    baseAbilities: { str: 10, dex: 10, con: 10, int: 16, wis: 14, cha: 12 },
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
const wizard1 = () => sheetOf(["wizard"], {
  1: [{ type: "spells", source: "x", value: { class: CLASSES.wizard.ref, cantrips: [spell("light")], spells: BOOK } }],
});

// Como la ruta: bloques y espacios de la hoja guardada, y solo entradas del catálogo
const apply = (sheet: Dnd2024SheetV2, op: unknown) => {
  const { blocks, slots } = derive(sheet, entries).spells;
  return applySpellOp(sheet, op, { blocks, slots, resolve: (r: Ref) => entries.get(refKey(r)) ?? null });
};
const prepare = (cls: Named, name: string) => ({ op: "prepare", class: cls.ref, ref: spell(name).ref });
const ok = (r: ReturnType<typeof apply>) => {
  if (!r.ok) throw new Error(r.error);
  return r.sheet;
};
const errorOf = (r: ReturnType<typeof apply>) => (r.ok ? null : r.error);

describe("preparar conjuros", () => {
  it("Clérigo 1: prepara de su lista hasta el límite (4) y el 5.º falla", () => {
    let s = sheetOf(["cleric"]);
    for (const name of ["bless", "cure wounds", "guiding bolt", "healing word"]) s = ok(apply(s, prepare(CLASSES.cleric, name)));
    expect(s.prepared["class:cleric|xphb"]).toHaveLength(4);
    expect(errorOf(apply(s, prepare(CLASSES.cleric, "sanctuary")))).toBe("Ya tienes 4 de 4 conjuros preparados.");
  });
  it("dos peticiones sobre el mismo estado: la segunda, aplicada sobre el resultado de la primera, falla", () => {
    let s = sheetOf(["cleric"]);
    for (const name of ["bless", "cure wounds", "guiding bolt"]) s = ok(apply(s, prepare(CLASSES.cleric, name)));
    const first = ok(apply(s, prepare(CLASSES.cleric, "healing word")));
    // La ruta relee lo guardado: la segunda ve el resultado de la primera
    expect(errorOf(apply(first, prepare(CLASSES.cleric, "sanctuary")))).toBe("Ya tienes 4 de 4 conjuros preparados.");
    expect(first.prepared["class:cleric|xphb"]).toHaveLength(4);
  });
  it("conjuro de la lista del Mago para un Clérigo → error", () => {
    expect(errorOf(apply(sheetOf(["cleric"]), prepare(CLASSES.cleric, "sleep")))).toBe("sleep no está en la lista de Clérigo.");
  });
  it("conjuro de nivel 3 con máximo 1 → error", () => {
    expect(errorOf(apply(sheetOf(["cleric"]), prepare(CLASSES.cleric, "spirit guardians"))))
      .toBe("spirit guardians es de nivel 3; Clérigo puede preparar hasta el nivel 1.");
  });
  it("los trucos no se preparan", () => {
    expect(errorOf(apply(sheetOf(["cleric"]), prepare(CLASSES.cleric, "light")))).toBe("Los trucos no se preparan.");
  });
  it("modo levelUp (Hechicero) no admite prepare", () => {
    expect(errorOf(apply(sheetOf(["sorcerer"]), prepare(CLASSES.sorcerer, "shield"))))
      .toBe("Los conjuros de Hechicero se cambian al subir de nivel.");
  });
  it("una clase que no tiene → error", () => {
    expect(errorOf(apply(sheetOf(["cleric"]), prepare(CLASSES.wizard, "sleep")))).toBe("Esa clase no lanza conjuros.");
  });
  it("conjuro que no está en el catálogo (o en otro libro) → error", () => {
    const op = { op: "prepare", class: CLASSES.cleric.ref, ref: { book: "otro", key: "spell:bless|xphb" } };
    expect(errorOf(apply(sheetOf(["cleric"]), op))).toBe("Conjuro no disponible.");
  });
  it("preparar uno ya preparado no cambia nada", () => {
    const s = ok(apply(sheetOf(["cleric"]), prepare(CLASSES.cleric, "bless")));
    expect(ok(apply(s, prepare(CLASSES.cleric, "bless"))).prepared["class:cleric|xphb"]).toHaveLength(1);
  });
  it("Mago: solo prepara de su libro", () => {
    const s = ok(apply(wizard1(), prepare(CLASSES.wizard, "shield")));
    expect(s.prepared["class:wizard|xphb"]).toEqual([spell("shield").ref]);
    expect(errorOf(apply(s, prepare(CLASSES.wizard, "grease")))).toBe("grease no está en tu libro de conjuros.");
  });
  it("dejar de preparar quita el conjuro (y si no estaba, no cambia nada)", () => {
    const s = ok(apply(sheetOf(["cleric"]), prepare(CLASSES.cleric, "bless")));
    const op = { op: "unprepare", class: CLASSES.cleric.ref, ref: spell("bless").ref };
    const after = ok(apply(s, op));
    expect(after.prepared["class:cleric|xphb"]).toEqual([]);
    expect(ok(apply(after, op)).prepared["class:cleric|xphb"]).toEqual([]);
  });
});

describe("copiar al libro", () => {
  it("Mago: copia un conjuro de su lista; repetido → error", () => {
    const s = ok(apply(wizard1(), { op: "copy", ref: spell("grease").ref }));
    expect(s.spellbookExtra).toEqual([spell("grease")]);
    expect(errorOf(apply(s, { op: "copy", ref: spell("grease").ref }))).toBe("grease ya está en tu libro de conjuros.");
    expect(errorOf(apply(s, { op: "copy", ref: spell("shield").ref }))).toBe("shield ya está en tu libro de conjuros.");
  });
  it("un conjuro de Mago que ya tiene por una dote también se puede copiar", () => {
    const s = wizard1();
    s.levels[0].choices.push({
      type: "featSpells", source: "featSpells:feat:magic initiate; wizard|xphb",
      value: { feat: ref("feat:magic initiate; wizard|xphb"), cantrips: [], spells: [spell("grease")] },
    });
    expect(ok(apply(s, { op: "copy", ref: spell("grease").ref })).spellbookExtra).toEqual([spell("grease")]);
  });
  it("de otra lista, truco o sin libro → error", () => {
    expect(errorOf(apply(wizard1(), { op: "copy", ref: spell("bless").ref }))).toBe("bless no está en la lista de Mago.");
    expect(errorOf(apply(wizard1(), { op: "copy", ref: spell("light").ref }))).toBe("Los trucos no se copian al libro.");
    expect(errorOf(apply(sheetOf(["cleric"]), { op: "copy", ref: spell("bless").ref })))
      .toBe("Solo se copian conjuros a un libro de conjuros.");
  });
});

describe("espacios", () => {
  it("gasta espacios hasta los disponibles; por encima → error", () => {
    // Clérigo 3: 4 de nivel 1 y 2 de nivel 2
    const s = sheetOf(["cleric", "cleric", "cleric"]);
    expect(ok(apply(s, { op: "slot", level: "2", used: 2 })).slotsUsed).toEqual({ 2: 2 });
    expect(errorOf(apply(s, { op: "slot", level: "2", used: 3 }))).toBe("Solo tienes 2 espacios de nivel 2.");
    expect(errorOf(apply(s, { op: "slot", level: "3", used: 1 }))).toBe("No tienes espacios de nivel 3.");
    expect(errorOf(apply(s, { op: "slot", level: "1", used: -1 }))).toBe("Solo tienes 4 espacios de nivel 1.");
    expect(errorOf(apply(s, { op: "slot", level: "10", used: 0 }))).toBe("Nivel de espacio no válido.");
  });
  it("Magia de pacto aparte", () => {
    const s = sheetOf(["warlock", "warlock"]);
    expect(ok(apply(s, { op: "slot", level: "pact", used: 2 })).slotsUsed).toEqual({ pact: 2 });
    expect(errorOf(apply(s, { op: "slot", level: "pact", used: 3 }))).toBe("Solo tienes 2 espacios de Magia de pacto.");
    expect(errorOf(apply(s, { op: "slot", level: "1", used: 1 }))).toBe("No tienes espacios de nivel 1.");
  });
  it("descanso largo: todo a 0", () => {
    const s = { ...sheetOf(["cleric", "cleric", "cleric"]), slotsUsed: { 1: 3, 2: 1 } };
    const after = ok(apply(s, { op: "longRest" }));
    expect(Object.values(after.slotsUsed).every((v) => v === 0)).toBe(true);
    expect(derive(after, entries).spells.used).toEqual({});
  });
  it("operación desconocida → error", () => {
    expect(errorOf(apply(sheetOf(["cleric"]), { op: "nada" }))).toBe("Operación no válida.");
    expect(errorOf(apply(sheetOf(["cleric"]), null))).toBe("Petición no válida.");
  });
});

describe("tierra del Círculo de la Tierra", () => {
  const LAND = ref("subclass:circle of the land|druid|xphb");
  const druid3 = () => sheetOf(["druid", "druid", "druid"], {
    3: [{ type: "subclass", source: "class:subclass", value: { ref: LAND, name: "Círculo de la Tierra" } }],
  });
  it("elige una tierra de la subclase, la cambia y la quita", () => {
    const s = ok(apply(druid3(), { op: "setOption", subclass: LAND, name: "Arid Land" }));
    expect(s.spellOption).toEqual({ [LAND.key]: "Arid Land" });
    expect(ok(apply(s, { op: "setOption", subclass: LAND, name: "Polar Land" })).spellOption).toEqual({ [LAND.key]: "Polar Land" });
    expect(ok(apply(s, { op: "setOption", subclass: LAND, name: null })).spellOption).toEqual({});
  });
  const DRUID = CLASSES.druid.ref.key;
  it("los preparados que pasan a ser de la tierra dejan de estar preparados (y de contar)", () => {
    const s = druid3();
    s.prepared = { [DRUID]: [spell("fog cloud").ref, spell("cure wounds").ref] };
    const after = ok(apply(s, { op: "setOption", subclass: LAND, name: "Polar Land" }));
    expect(after.prepared[DRUID]).toEqual([spell("cure wounds").ref]);
    expect(derive(after, entries).spells.blocks[0].prepared).toEqual([spell("cure wounds").ref]);
  });
  it("un preparado que también es de la tierra no ocupa sitio: se puede preparar hasta el límite", () => {
    const s = druid3();
    s.spellOption = { [LAND.key]: "Polar Land" };
    s.prepared = { [DRUID]: ["fog cloud", "cure wounds", "entangle", "goodberry", "thunderwave", "faerie fire"].map((n) => spell(n).ref) };
    const [b] = derive(s, entries).spells.blocks;
    expect(b.preparedLimit).toBe(6);
    expect(b.prepared).toHaveLength(5);
    expect(ok(apply(s, prepare(CLASSES.druid, "jump"))).prepared[DRUID]).toHaveLength(7);
  });
  it("una tierra que no existe o una subclase sin tierras → error", () => {
    expect(errorOf(apply(druid3(), { op: "setOption", subclass: LAND, name: "Lunar Land" }))).toBe("Opción no válida.");
    expect(errorOf(apply(sheetOf(["cleric"]), { op: "setOption", subclass: LAND, name: "Arid Land" })))
      .toBe("Esa subclase no tiene conjuros a elegir.");
  });
});

describe("trimSpells (al perder un nivel)", () => {
  const level = (r: Ref) => (entries.get(refKey(r))?.data as SpellData | undefined)?.level;

  it("quita los preparados por encima del nuevo máximo y del nuevo límite (los últimos) y recorta los espacios", () => {
    // Clérigo 3 → 2: límite 5 (antes 6), máximo nivel 1 (antes 2)
    const s = sheetOf(["cleric", "cleric", "cleric"]);
    s.prepared = { "class:cleric|xphb": ["bless", "aid", "cure wounds", "guiding bolt", "healing word", "sanctuary"].map((n) => spell(n).ref) };
    s.slotsUsed = { 1: 4, 2: 2 };
    const after = derive(sheetOf(["cleric", "cleric"]), entries).spells;
    expect(after.blocks[0].preparedLimit).toBe(5);
    const t = trimSpells(s, { ...after, spellLevel: level });
    expect(t.prepared["class:cleric|xphb"].map((r) => r.key))
      .toEqual(["spell:bless|xphb", "spell:cure wounds|xphb", "spell:guiding bolt|xphb", "spell:healing word|xphb", "spell:sanctuary|xphb"]);
    expect(t.slotsUsed).toEqual({ 1: 3 });

    // Si sobran, se quitan los últimos añadidos
    s.prepared = { "class:cleric|xphb": ["bless", "cure wounds", "guiding bolt", "healing word", "sanctuary", "command"].map((n) => spell(n).ref) };
    expect(trimSpells(s, { ...after, spellLevel: level }).prepared["class:cleric|xphb"].map((r) => r.key).at(-1)).toBe("spell:sanctuary|xphb");
  });
  it("la clase que deja de lanzar pierde sus preparados", () => {
    const s = sheetOf(["wizard", "cleric"]);
    s.prepared = { "class:cleric|xphb": [spell("bless").ref], "class:wizard|xphb": [] };
    const t = trimSpells(s, { ...derive(sheetOf(["wizard"]), entries).spells, spellLevel: level });
    expect(t.prepared).toEqual({ "class:wizard|xphb": [] });
  });
});

describe("Secretos mágicos (Bardo 10)", () => {
  const times = (id: string, n: number) => Array<string>(n).fill(id);
  // Bardo de nivel `n` que eligió en el nivel 10 un conjuro de la lista del Mago (Dormir)
  const bard = (n: number) => sheetOf(times("bard", n), {
    10: [{ type: "spells", source: "progression:spells|bard|xphb", value: { class: CLASSES.bard.ref, cantrips: [], spells: [spell("sleep")] } }],
  });
  const blockOf = (s: Dnd2024SheetV2) => derive(s, entries).spells.blocks[0];

  it("desde el nivel 10, el bloque del Bardo lleva las cuatro listas; antes, ninguna", () => {
    expect(blockOf(bard(9)).lists).toBeUndefined();
    expect(blockOf(bard(10)).lists).toEqual(["bard", "cleric", "druid", "wizard"]);
  });
  it("el Bardo no prepara en la ficha (los cambia al subir), con o sin Secretos mágicos", () => {
    for (const n of [9, 10]) {
      expect(errorOf(apply(bard(n), prepare(CLASSES.bard, "sleep")))).toBe("Los conjuros de Bardo se cambian al subir de nivel.");
    }
  });
  it("al borrar el nivel 10, el conjuro de Mago que eligió en él deja de estar preparado", () => {
    const s = bard(10);
    expect(blockOf(s).prepared).toEqual([spell("sleep").ref]);
    const after = derive(bard(9), entries).spells;
    const r = removeLastLevel(s, 50, Infinity, { ...after, spellLevel: () => 1 });
    if (!r.ok) throw new Error(r.error);
    expect(blockOf(r.sheet).prepared).toEqual([]);
    expect(blockOf(r.sheet).lists).toBeUndefined();
  });
});

describe("usos por descanso largo (Arcano místico)", () => {
  const ARCANUM = "classFeature:mystic arcanum|warlock|xphb|11";
  const KEY = `arcanum:${B}:spell:circle of death|xphb`;
  const warlock11 = () => sheetOf(Array<string>(11).fill("warlock"), {
    11: [{ type: "arcanum", source: ARCANUM, value: spell("circle of death") }],
  });

  it("el bloque del Brujo lista su arcano con una casilla (gastada según la hoja)", () => {
    const s = warlock11();
    expect(derive(s, entries).spells.blocks[0].limited).toEqual([
      { key: KEY, spell: spell("circle of death"), origin: "Arcano místico", max: 1, used: 0 },
    ]);
    s.limitedUsed = { [KEY]: 1 };
    expect(derive(s, entries).spells.blocks[0].limited[0].used).toBe(1);
    expect(derive(sheetOf(["warlock"]), entries).spells.blocks[0].limited).toEqual([]);
  });
  it("op limited: clave que no tiene o fuera de 0..máximo → error; dentro → se guarda", () => {
    const s = warlock11();
    expect(errorOf(apply(s, { op: "limited", key: "arcanum:otra", used: 1 }))).toBe("No tienes ese uso.");
    expect(errorOf(apply(s, { op: "limited", key: KEY, used: 2 }))).toBe("circle of death solo tiene 1 uso por descanso largo.");
    expect(errorOf(apply(s, { op: "limited", key: KEY, used: -1 }))).toBe("circle of death solo tiene 1 uso por descanso largo.");
    expect(errorOf(apply(s, { op: "limited", key: KEY, used: 0.5 }))).toBe("circle of death solo tiene 1 uso por descanso largo.");
    const used = ok(apply(s, { op: "limited", key: KEY, used: 1 }));
    expect(used.limitedUsed).toEqual({ [KEY]: 1 });
    expect(ok(apply(used, { op: "limited", key: KEY, used: 0 })).limitedUsed).toEqual({ [KEY]: 0 });
  });
  it("el descanso largo también recupera los usos", () => {
    const s = { ...warlock11(), limitedUsed: { [KEY]: 1 }, slotsUsed: { pact: 2 } };
    const after = ok(apply(s, { op: "longRest" }));
    expect(after.limitedUsed).toEqual({});
    expect(after.slotsUsed).toEqual({});
  });
  it("el descanso corto recupera la Magia de pacto y los Conjuros distintivos, no los arcanos ni otros espacios", () => {
    const SIGNATURE = `signature:${B}:spell:fireball|xphb`;
    const s = { ...warlock11(), limitedUsed: { [KEY]: 1, [SIGNATURE]: 1 }, slotsUsed: { pact: 2, 1: 1 } };
    const after = ok(apply(s, { op: "shortRest" }));
    expect(after.limitedUsed).toEqual({ [KEY]: 1 });
    expect(after.slotsUsed).toEqual({ 1: 1 });
    // Sin usos guardados no los añade
    expect(ok(apply({ ...warlock11(), slotsUsed: { pact: 1 } }, { op: "shortRest" }))).not.toHaveProperty("limitedUsed");
  });
});

describe("conjuros extra del Bardo del Saber y del Mago", () => {
  // Conjuros con escuela y tiempo de lanzamiento (para el Sabio y el Dominio de conjuros)
  for (const [name, level, school, time] of [
    ["chromatic orb", 1, "V", "1 acción"], ["feather fall", 1, "T", "1 reacción"], ["invisibility", 2, "I", "1 acción"],
    ["misty step", 2, "C", "1 acción adicional"], ["fireball", 3, "V", "1 acción"], ["lightning bolt", 3, "V", "1 acción"],
    ["minor illusion", 0, "I", "1 acción"], ["silent image", 1, "I", "1 acción"],
  ] as [string, number, string, string][]) {
    const data: SpellData = {
      level, school, time, range: "", components: "", duration: "", concentration: false, ritual: false, classes: ["wizard"], tags: [],
    };
    entries.set(`${B}:spell:${name}|xphb`, { ...entries.get(`${B}:spell:sleep|xphb`)!, ref: ref(`spell:${name}|xphb`), name, data });
  }
  const times = (id: string, n: number) => Array<string>(n).fill(id);
  const spellsOf = (cls: Named, cantrips: string[], spells: string[], free?: string[]): Choice => ({
    type: "spells", source: "x",
    value: { class: cls.ref, cantrips: cantrips.map(spell), spells: spells.map(spell), ...(free ? { free: free.map(spell) } : {}) },
  });
  const subclass = (key: string, name: string): Choice => ({ type: "subclass", source: "class:subclass", value: { ref: ref(key), name } });
  const bonus = (source: string, names: string[], replace?: [string, string]): Choice => ({
    type: "bonusSpells", source,
    value: { spells: names.map(spell), ...(replace ? { replace: { out: spell(replace[0]), in: spell(replace[1]) } } : {}) },
  });
  const blockOf = (s: Dnd2024SheetV2) => derive(s, entries).spells.blocks[0];
  const alwaysOf = (s: Dnd2024SheetV2) => blockOf(s).always.map((a) => [a.spell.name, a.origin]);

  describe("Descubrimientos mágicos (Saber 6)", () => {
    const SOURCE = "subclassFeature:magical discoveries|bard|xphb|lore|xphb|6";
    const lore = (n: number, extra: Record<number, Choice[]> = {}) => sheetOf(times("bard", n), {
      3: [subclass("subclass:college of lore|bard|xphb", "Colegio del Saber")],
      6: [bonus(SOURCE, ["light", "cure wounds"])],
      ...extra,
    });

    it("quedan siempre preparados en el bloque del Bardo y no cuentan para el límite", () => {
      const s = lore(6);
      expect(alwaysOf(s)).toEqual([["light", "Descubrimientos mágicos"], ["cure wounds", "Descubrimientos mágicos"]]);
      expect(blockOf(s).prepared).toEqual([]);
    });
    it("con la sustitución de un nivel posterior, el sustituto ocupa su sitio", () => {
      const s = lore(7, { 7: [bonus(SOURCE, [], ["cure wounds", "fog cloud"])] });
      expect(alwaysOf(s)).toEqual([["light", "Descubrimientos mágicos"], ["fog cloud", "Descubrimientos mágicos"]]);
    });
  });

  describe("Sabio de la escuela e Ilusiones mejoradas (Ilusionista 3)", () => {
    const ILLUSIONIST = subclass("subclass:illusionist|wizard|xphb", "Ilusionista");
    it("los conjuros gratis del Sabio entran en el libro", () => {
      const s = sheetOf(times("wizard", 3), {
        1: [spellsOf(CLASSES.wizard, ["light"], ["magic missile"])],
        3: [ILLUSIONIST, spellsOf(CLASSES.wizard, [], ["sleep"], ["silent image", "invisibility"])],
      });
      expect(blockOf(s).spellbook.map((n) => n.name)).toEqual(["magic missile", "sleep", "silent image", "invisibility"]);
    });
    it("concede Ilusión menor como siempre preparado de Ilusiones mejoradas (no de la subclase)", () => {
      const s = sheetOf(times("wizard", 3), { 1: [spellsOf(CLASSES.wizard, ["light"], [])], 3: [ILLUSIONIST] });
      expect(alwaysOf(s)).toEqual([["minor illusion", "Ilusiones mejoradas"]]);
    });
    it("si ya la conocía, no la repite y queda el truco elegido en su lugar", () => {
      const s = sheetOf(times("wizard", 3), {
        1: [spellsOf(CLASSES.wizard, ["minor illusion"], [])],
        3: [ILLUSIONIST, bonus("subclassFeature:improved illusions|wizard|xphb|illusionist|xphb|3", ["light"])],
      });
      expect(alwaysOf(s)).toEqual([["light", "Ilusiones mejoradas"]]);
      expect(blockOf(s).cantrips.map((n) => n.name)).toEqual(["minor illusion"]);
    });
  });

  describe("Dominio de conjuros (Mago 18) y Conjuros distintivos (Mago 20)", () => {
    const BOOK18 = ["chromatic orb", "feather fall", "invisibility", "misty step", "fireball", "lightning bolt", "sleep"];
    const wizard = (n: number, extra: Record<number, Choice[]> = {}) =>
      sheetOf(times("wizard", n), { 1: [spellsOf(CLASSES.wizard, ["light"], BOOK18)], ...extra });
    const setMastery = (level: unknown, name: string | null) => ({ op: "setMastery", level, ref: name ? spell(name).ref : null });

    it("Mago 17: no tiene Dominio de conjuros", () => {
      expect(blockOf(wizard(17)).mastery).toBeUndefined();
      expect(errorOf(apply(wizard(17), setMastery(1, "chromatic orb")))).toBe("No tienes Dominio de conjuros.");
    });
    it("Mago 18: elige un conjuro de nivel 1 y otro de nivel 2 del libro, que quedan siempre preparados", () => {
      expect(blockOf(wizard(18)).mastery).toEqual({ 1: null, 2: null });
      let s = ok(apply(wizard(18), setMastery(1, "chromatic orb")));
      s = ok(apply(s, setMastery(2, "invisibility")));
      expect(s.spellMastery).toEqual({ 1: spell("chromatic orb").ref, 2: spell("invisibility").ref });
      expect(blockOf(s).mastery).toEqual({ 1: spell("chromatic orb").ref, 2: spell("invisibility").ref });
      expect(alwaysOf(s)).toEqual([["chromatic orb", "Dominio de conjuros"], ["invisibility", "Dominio de conjuros"]]);
      // `ref: null` lo quita
      expect(ok(apply(s, setMastery(1, null))).spellMastery).toEqual({ 2: spell("invisibility").ref });
    });
    it("fuera del libro, de otro nivel, sin tiempo de una acción o de un nivel que no es 1 ni 2 → error", () => {
      const s = wizard(18);
      expect(errorOf(apply(s, setMastery(1, "magic missile")))).toBe("magic missile no está en tu libro de conjuros.");
      expect(errorOf(apply(s, setMastery(1, "invisibility")))).toBe("invisibility no es un conjuro de nivel 1.");
      expect(errorOf(apply(s, setMastery(1, "feather fall")))).toBe("feather fall no se lanza con una acción.");
      expect(errorOf(apply(s, setMastery(2, "misty step")))).toBe("misty step no se lanza con una acción.");
      expect(errorOf(apply(s, setMastery(3, "fireball")))).toBe("Nivel no válido.");
    });
    it("un conjuro de Dominio que deja de estar en el libro (borrar el nivel que lo dio) no aparece ni se elige", () => {
      const s = { ...wizard(19, { 19: [spellsOf(CLASSES.wizard, [], ["silent image"])] }), spellMastery: { 1: spell("silent image").ref } };
      expect(blockOf(s).mastery).toEqual({ 1: spell("silent image").ref, 2: null });
      const r = removeLastLevel(s, 50, Infinity, { ...derive(wizard(18), entries).spells, spellLevel: () => 1 });
      if (!r.ok) throw new Error(r.error);
      expect(blockOf(r.sheet).mastery).toEqual({ 1: null, 2: null });
      expect(alwaysOf(r.sheet)).toEqual([]);
    });
    it("Mago 18 que borra su nivel 18: se olvida el Dominio de conjuros elegido", () => {
      const s = ok(apply(wizard(18), setMastery(1, "chromatic orb")));
      const r = removeLastLevel(s, 50, Infinity, { ...derive(wizard(17), entries).spells, spellLevel: () => 1 });
      if (!r.ok) throw new Error(r.error);
      expect(r.sheet.spellMastery).toBeUndefined();
      // Mago 19 que baja a 18: lo conserva
      const s19 = ok(apply(wizard(19), setMastery(1, "chromatic orb")));
      const r19 = removeLastLevel(s19, 50, Infinity, { ...derive(wizard(18), entries).spells, spellLevel: () => 1 });
      if (!r19.ok) throw new Error(r19.error);
      expect(r19.sheet.spellMastery).toEqual({ 1: spell("chromatic orb").ref });
    });
    it("Mago 20 de antes de Conjuros distintivos (sin elegirlos): el bloque lo avisa", () => {
      expect(blockOf(wizard(20)).signatureMissing).toBe(true);
      expect(blockOf(wizard(19)).signatureMissing).toBeUndefined();
      const s = wizard(20, { 20: [bonus("classFeature:signature spells|wizard|xphb|20", ["fireball", "lightning bolt"])] });
      expect(blockOf(s).signatureMissing).toBeUndefined();
    });
    it("Mago 20: los conjuros distintivos quedan siempre preparados con un uso cada uno", () => {
      const s = wizard(20, { 20: [bonus("classFeature:signature spells|wizard|xphb|20", ["fireball", "lightning bolt"])] });
      expect(alwaysOf(s)).toEqual([["fireball", "Conjuros distintivos"], ["lightning bolt", "Conjuros distintivos"]]);
      const key = `signature:${B}:spell:fireball|xphb`;
      expect(blockOf(s).limited).toEqual([
        { key, spell: spell("fireball"), origin: "Conjuros distintivos", max: 1, used: 0 },
        { key: `signature:${B}:spell:lightning bolt|xphb`, spell: spell("lightning bolt"), origin: "Conjuros distintivos", max: 1, used: 0 },
      ]);
      expect(ok(apply(s, { op: "limited", key, used: 1 })).limitedUsed).toEqual({ [key]: 1 });
      expect(errorOf(apply(s, { op: "limited", key, used: 2 }))).toBe("fireball solo tiene 1 uso por descanso largo.");
    });
  });

  describe("Arcano místico: sustitución y usos al borrar el nivel", () => {
    const ARCANUM = (n: number) => `classFeature:mystic arcanum|warlock|xphb|${n}`;
    const KEY = (name: string) => `arcanum:${B}:spell:${name}|xphb`;
    const warlock = (n: number, extra: Record<number, Choice[]> = {}) => sheetOf(times("warlock", n), {
      11: [{ type: "arcanum", source: ARCANUM(11), value: spell("circle of death") }],
      13: [{ type: "arcanum", source: ARCANUM(13), value: spell("fireball") }],
      ...extra,
    });

    it("la sustitución de un nivel posterior cambia el arcano (y su clave de usos)", () => {
      const swap = { out: spell("circle of death"), in: spell("sleep") };
      const s = warlock(14, { 14: [{ type: "arcanum", source: ARCANUM(13), value: null, replace: swap }] });
      expect(blockOf(s).limited.map((l) => l.key)).toEqual([KEY("fireball"), KEY("sleep")]);
    });
    it("al borrar el nivel que dio un arcano, su uso gastado se quita de la hoja", () => {
      const s = { ...warlock(13), limitedUsed: { [KEY("circle of death")]: 1, [KEY("fireball")]: 1 } };
      const r = removeLastLevel(s, 50, Infinity, { ...derive(warlock(12), entries).spells, spellLevel: () => 1 });
      if (!r.ok) throw new Error(r.error);
      expect(r.sheet.limitedUsed).toEqual({ [KEY("circle of death")]: 1 });
    });
  });
});
