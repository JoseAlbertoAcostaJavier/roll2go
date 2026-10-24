import { describe, expect, it } from "vitest";
import { derive } from "@/lib/rules/dnd2024/derive";
import { casterBlocks, otherSpells, spellSlots } from "@/lib/rules/dnd2024/derive/spells";
import type { Choice, Dnd2024SheetV2, LevelEntry, Named } from "@/lib/rules/dnd2024/sheet";
import { casterLevel, maxSpellLevel, spellbookSize } from "@/lib/rules/dnd2024/spellcasting";
import type { ClassData, SubclassData } from "@/lib/rules/types";
import { B, buildCatalog, ref } from "./fixtureCatalog";

const entries = buildCatalog([
  "class-barbarian.json", "class-cleric.json", "class-wizard.json", "class-paladin.json", "class-sorcerer.json",
  "class-warlock.json", "class-fighter.json",
]);
const classData = (key: string) => entries.get(`${B}:${key}`)!.data as ClassData;

const CLASSES: Record<string, Named> = {
  barbarian: { ref: ref("class:barbarian|xphb"), name: "Bárbaro" },
  cleric: { ref: ref("class:cleric|xphb"), name: "Clérigo" },
  wizard: { ref: ref("class:wizard|xphb"), name: "Mago" },
  paladin: { ref: ref("class:paladin|xphb"), name: "Paladín" },
  sorcerer: { ref: ref("class:sorcerer|xphb"), name: "Hechicero" },
  warlock: { ref: ref("class:warlock|xphb"), name: "Brujo" },
  fighter: { ref: ref("class:fighter|xphb"), name: "Guerrero" },
};
const EK: Named = { ref: ref("subclass:eldritch knight|fighter|xphb"), name: "Caballero arcano" };
const spell = (name: string): Named => ({ ref: ref(`spell:${name}|xphb`), name });

/**
 * Hoja v2 con un nivel por elemento de `path` (identificador de clase); `choices[n]` son las elecciones del nivel
 * total `n` (1..).
 */
function sheetOf(path: string[], choices: Record<number, Choice[]> = {}, lineage: Named | null = null): Dnd2024SheetV2 {
  const count = new Map<string, number>();
  const levels: LevelEntry[] = path.map((id, i) => {
    count.set(id, (count.get(id) ?? 0) + 1);
    return {
      n: i + 1, class: CLASSES[id], classLevel: count.get(id)!, hp: { method: "average", value: 5 },
      choices: choices[i + 1] ?? [],
    };
  });
  return {
    version: 2,
    species: { ref: ref("species:elf|xphb"), name: "Elfo" },
    lineage,
    // Sin dote de trasfondo: el Acólito da Iniciado en la magia
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
const times = (id: string, n: number) => Array<string>(n).fill(id);

describe("reglas de lanzamiento", () => {
  it("nivel de lanzador: completos + ½ hacia arriba + ⅓ hacia abajo", () => {
    expect(casterLevel([{ progression: "full", level: 2 }, { progression: "half", level: 3 }])).toBe(4);
    expect(casterLevel([{ progression: "third", level: 5 }, { progression: "full", level: 1 }])).toBe(2);
    expect(casterLevel([{ progression: "pact", level: 5 }])).toBe(0);
  });
  it("nivel máximo de conjuro de una clase sola", () => {
    expect(maxSpellLevel("full", 1)).toBe(1);
    expect(maxSpellLevel("full", 5)).toBe(3);
    expect(maxSpellLevel("half", 5)).toBe(2);
    expect(maxSpellLevel("third", 2)).toBe(0);
    expect(maxSpellLevel("third", 7)).toBe(2);
    expect(maxSpellLevel("pact", 5)).toBe(3);
  });
  it("libro del Mago: 6 a nivel 1 y 2 más por nivel", () => {
    const p = classData("class:wizard|xphb").progressions;
    expect(spellbookSize(p, 1)).toBe(6);
    expect(spellbookSize(p, 3)).toBe(10);
  });
});

describe("bloques de lanzador", () => {
  const blocks = (s: Dnd2024SheetV2) => derive(s, entries).spells.blocks;

  it("Clérigo 1: trucos y preparados de su progresión, modo list, CD y ataque", () => {
    const p = classData("class:cleric|xphb").progressions;
    const [b] = blocks(sheetOf(["cleric"]));
    expect(b).toMatchObject({
      class: CLASSES.cleric.ref, name: "Clérigo", ability: "wis", mode: "list",
      cantripLimit: p.cantrips![0], preparedLimit: p.prepared![0], maxSpellLevel: 1,
      // 8 + 2 (competencia) + 2 (SAB 14)
      dc: 12, attack: 4,
    });
    expect(b.cantripLimit).toBe(3);
    expect(b.preparedLimit).toBe(4);
  });
  it("Mago 1: modo libro; el libro son las entradas del nivel y las copiadas", () => {
    const p = classData("class:wizard|xphb").progressions;
    const book = ["magic missile", "shield", "sleep", "mage armor", "detect magic", "burning hands"].map(spell);
    const s = sheetOf(["wizard"], {
      1: [{ type: "spells", source: "x", value: { class: CLASSES.wizard.ref, cantrips: [spell("light")], spells: book } }],
    });
    s.spellbookExtra = [spell("fireball")];
    s.prepared = { "class:wizard|xphb": [spell("shield").ref] };
    const [b] = blocks(s);
    expect(b).toMatchObject({
      mode: "spellbook", ability: "int", cantripLimit: p.cantrips![0], preparedLimit: p.prepared![0], dc: 13,
      prepared: [spell("shield").ref], known: [],
    });
    expect(b.cantrips.map((c) => c.name)).toEqual(["light"]);
    expect(b.spellbook).toHaveLength(7);
  });
  it("Paladín 1 y 2: preparados de su progresión (XPHB: lanza desde el nivel 1)", () => {
    const p = classData("class:paladin|xphb").progressions;
    expect(blocks(sheetOf(["paladin"]))[0]).toMatchObject({ preparedLimit: p.prepared![0], cantripLimit: 0, maxSpellLevel: 1 });
    expect(blocks(sheetOf(["paladin", "paladin"]))[0]).toMatchObject({ preparedLimit: p.prepared![1], mode: "list", ability: "cha" });
    expect(derive(sheetOf(["paladin"]), entries).spells.slots).toEqual({ levels: { 1: 2 }, pact: null });
  });
  it("Paladín 5: nivel máximo 2 (½ hacia arriba)", () => {
    expect(blocks(sheetOf(times("paladin", 5)))[0].maxSpellLevel).toBe(2);
  });
  it("Paladín 2: Castigo divino siempre preparado de la clase, que no cuenta", () => {
    const s = sheetOf(["paladin", "paladin"]);
    s.prepared = { "class:paladin|xphb": [spell("bless").ref] };
    const [b] = blocks(s);
    expect(b.always).toEqual([{ spell: { ref: ref("spell:divine smite|xphb"), name: "Divine smite" }, origin: "Paladín" }]);
    expect(b.prepared).toEqual([spell("bless").ref]);
    expect(b.preparedLimit).toBe(classData("class:paladin|xphb").progressions.prepared![1]);
    expect(blocks(sheetOf(["paladin"]))[0].always).toEqual([]);
  });
  it("Caballero arcano: bloque de la subclase con sus límites y espacios de tercio", () => {
    const s = sheetOf(times("fighter", 4), { 3: [{ type: "subclass", source: "class:subclass", value: EK }] });
    const sub = entries.get(`${B}:${EK.ref.key}`)!.data as SubclassData;
    const [b] = blocks(s);
    expect(b).toMatchObject({
      class: EK.ref, name: "Caballero arcano", ability: "int", mode: "levelUp", maxSpellLevel: 1,
      cantripLimit: sub.progressions.cantrips![3], preparedLimit: sub.progressions.prepared![3],
    });
    expect(b.cantripLimit).toBe(2);
    expect(b.preparedLimit).toBe(4);
    // Una sola clase lanzadora: tabla del Caballero arcano (⌈4/3⌉ = 2 → 3 espacios)
    expect(spellSlots(s, entries)).toEqual({ levels: { 1: 3 }, pact: null });
    // Multiclase con Clérigo 1: ⌊4/3⌋ + 1 = 2 → 3 espacios
    expect(spellSlots(sheetOf([...times("fighter", 4), "cleric"], { 3: [{ type: "subclass", source: "class:subclass", value: EK }] }), entries))
      .toEqual({ levels: { 1: 3 }, pact: null });
    expect(blocks(sheetOf(times("fighter", 2)))).toEqual([]);
  });
  it("sustitución de un truco", () => {
    const s = sheetOf(["sorcerer", "sorcerer"], {
      1: [{ type: "spells", source: "x", value: { class: CLASSES.sorcerer.ref, cantrips: [spell("light"), spell("mage hand")], spells: [spell("sleep")] } }],
      2: [{ type: "spells", source: "x", value: { class: CLASSES.sorcerer.ref, cantrips: [], spells: [spell("shield")], replace: { out: spell("light"), in: spell("fire bolt") } } }],
    });
    const [b] = blocks(s);
    expect(b.cantrips.map((c) => c.name)).toEqual(["mage hand", "fire bolt"]);
    expect(b.known.map((k) => k.name)).toEqual(["sleep", "shield"]);
  });
  it("modo levelUp: aprendidos con sustitución y preparados = aprendidos", () => {
    const s = sheetOf(["sorcerer", "sorcerer"], {
      1: [{ type: "spells", source: "x", value: { class: CLASSES.sorcerer.ref, cantrips: [spell("light")], spells: [spell("sleep"), spell("shield")] } }],
      2: [{ type: "spells", source: "x", value: { class: CLASSES.sorcerer.ref, cantrips: [], spells: [spell("grease")], replace: { out: spell("sleep"), in: spell("chromatic orb") } } }],
    });
    const [b] = blocks(s);
    expect(b.mode).toBe("levelUp");
    expect(b.known.map((k) => k.name)).toEqual(["shield", "grease", "chromatic orb"]);
    expect(b.prepared).toEqual(b.known.map((k) => k.ref));
  });
  it("subclase de dominio: siempre preparados hasta el nivel de clase, que no cuentan", () => {
    const life: Named = { ref: ref("subclass:life domain|cleric|xphb"), name: "Dominio de la vida" };
    expect(entries.has(`${B}:${life.ref.key}`)).toBe(true);
    const s = sheetOf(times("cleric", 3), { 3: [{ type: "subclass", source: "class:subclass", value: life }] });
    s.prepared = { "class:cleric|xphb": [spell("bless").ref] };
    const [b] = blocks(s);
    expect(b.always.map((a) => a.spell.ref.key).sort())
      .toEqual(["spell:aid|xphb", "spell:bless|xphb", "spell:cure wounds|xphb", "spell:lesser restoration|xphb"]);
    expect(b.always.every((a) => a.origin === "Dominio de la vida")).toBe(true);
    expect(b.prepared).toEqual([spell("bless").ref]);
    expect(b.preparedLimit).toBe(classData("class:cleric|xphb").progressions.prepared![2]);
  });
  it("sin clases lanzadoras: ningún bloque", () => {
    expect(blocks(sheetOf(["barbarian"]))).toEqual([]);
  });
  it("casterBlocks recibe las características y la competencia ya calculadas", () => {
    const s = sheetOf(["cleric"]);
    const d = derive(s, entries);
    expect(casterBlocks(s, d, entries)).toEqual(d.spells.blocks);
  });
});

describe("espacios", () => {
  it("multiclase Paladín 3 + Hechicero 2 → lanzador 4: 4/3", () => {
    const s = sheetOf(["paladin", "paladin", "paladin", "sorcerer", "sorcerer"]);
    expect(spellSlots(s, entries)).toEqual({ levels: { 1: 4, 2: 3 }, pact: null });
  });
  it("Brujo 2: Magia de pacto y sin espacios normales", () => {
    expect(spellSlots(sheetOf(["warlock", "warlock"]), entries)).toEqual({ levels: {}, pact: { count: 2, level: 1 } });
  });
  it("Brujo y Clérigo: la Magia de pacto va aparte", () => {
    expect(spellSlots(sheetOf(["warlock", "cleric"]), entries)).toEqual({ levels: { 1: 2 }, pact: { count: 1, level: 1 } });
  });
  it("sin lanzadores: sin espacios", () => {
    expect(spellSlots(sheetOf(["barbarian"]), entries)).toEqual({ levels: {}, pact: null });
  });
  it("los espacios gastados salen de la hoja", () => {
    const s = sheetOf(["cleric"]);
    s.slotsUsed = { 1: 1 };
    expect(derive(s, entries).spells.used).toEqual({ 1: 1 });
  });
});

describe("otros conjuros", () => {
  it("Elfo Alto: conjuros del legado hasta el nivel total con su origen", () => {
    const high: Named = { ref: ref("lineage:high elf|xphb"), name: "Alto elfo" };
    expect(otherSpells(sheetOf(["barbarian"], {}, high), entries)).toEqual([]);
    const other = otherSpells(sheetOf(times("barbarian", 3), {}, high), entries);
    expect(other).toEqual([{ spell: { ref: ref("spell:detect magic|xphb"), name: "Detect magic" }, origin: "Legado: Alto elfo" }]);
  });
  it("sin lanzador con Iniciado en la magia: tiene conjuros y ningún bloque", () => {
    const s = sheetOf(["barbarian"]);
    expect(derive(s, entries).hasSpells).toBe(false);
    s.background = { ref: ref("background:acolyte|xphb"), name: "Acólito", abilities: {}, equipment: "A" };
    const d = derive(s, entries);
    expect(d.hasSpells).toBe(true);
    expect(d.spells.blocks).toEqual([]);
  });
  it("dote con conjuros fijos: Tocado por los feéricos → Paso brumoso", () => {
    const fey: Named = { ref: ref("feat:fey-touched|xphb"), name: "Tocado por los feéricos" };
    const s = sheetOf(times("barbarian", 4), { 4: [{ type: "asi", source: "x", value: { feat: fey } }] });
    expect(otherSpells(s, entries)).toEqual([
      { spell: { ref: ref("spell:misty step|xphb"), name: "Misty step" }, origin: "Dote: Tocado por los feéricos" },
    ]);
    expect(derive(s, entries).hasSpells).toBe(true);
  });
  it("con legado que da conjuros: tiene conjuros", () => {
    const wood: Named = { ref: ref("lineage:wood elf|xphb"), name: "Elfo silvano" };
    const d = derive(sheetOf(["barbarian"], {}, wood), entries);
    expect(d.hasSpells).toBe(true);
    expect(d.spells.other.map((o) => o.origin)).toEqual(["Legado: Elfo silvano"]);
  });
});
