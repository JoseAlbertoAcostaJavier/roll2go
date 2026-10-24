import { describe, expect, it } from "vitest";
import { derive } from "@/lib/rules/dnd2024/derive";
import { refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import type { Choice, Dnd2024SheetV2, LevelEntry, Named } from "@/lib/rules/dnd2024/sheet";
import { applySpellOp, trimSpells } from "@/lib/rules/dnd2024/spellOps";
import type { Ref, SpellData } from "@/lib/rules/types";
import { B, buildCatalog, ref } from "./fixtureCatalog";

const entries = buildCatalog(["class-cleric.json", "class-wizard.json", "class-sorcerer.json", "class-warlock.json", "class-druid.json"]);

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
