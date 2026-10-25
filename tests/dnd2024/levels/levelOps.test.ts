import { describe, expect, it } from "vitest";
import { applyLevel, checkExpectedLevel, removeLastLevel } from "@/lib/rules/dnd2024/levels/levelOps";
import type { CasterBlock } from "@/lib/rules/dnd2024/derive";
import type { Dnd2024SheetV2, LevelEntry } from "@/lib/rules/dnd2024/sheet/sheet";
import { ref } from "../fixtureCatalog";

const cls = (key: string, name: string) => ({ ref: ref(key), name });
const barbarian = cls("class:barbarian|xphb", "Bárbaro");
const cleric = cls("class:cleric|xphb", "Clérigo");
const lvl = (n: number, c: typeof barbarian, classLevel: number, choices: LevelEntry["choices"] = []): LevelEntry => ({
  n, class: c, classLevel, hp: { method: "average", value: 7 }, choices,
});
const sheetOf = (levels: LevelEntry[], hp: { current: number | null }, extra: object = {}) =>
  ({
    version: 2,
    levels,
    classesSummary: [],
    hp: { max: null, current: hp.current, temp: 2 },
    ...extra,
  }) as unknown as Dnd2024SheetV2;

describe("applyLevel", () => {
  it("añade la entrada y recalcula el resumen de clases", () => {
    const sheet = sheetOf([lvl(1, barbarian, 1), lvl(2, barbarian, 2), lvl(3, barbarian, 3)], { current: 30 });
    const next = applyLevel(sheet, lvl(4, cleric, 1), 30, 37);
    expect(next.levels).toHaveLength(4);
    expect(next.classesSummary.map((c) => `${c.class.name} ${c.level}`).join(" / ")).toBe("Bárbaro 3 / Clérigo 1");
    expect(sheet.levels).toHaveLength(3);
  });
  it("sube los PG actuales con el máximo si estaban al máximo", () => {
    const sheet = sheetOf([lvl(1, barbarian, 1)], { current: 12 });
    expect(applyLevel(sheet, lvl(2, barbarian, 2), 12, 19).hp).toEqual({ max: null, current: 19, temp: 2 });
  });
  it("deja los PG actuales si no estaban al máximo", () => {
    const sheet = sheetOf([lvl(1, barbarian, 1)], { current: 5 });
    expect(applyLevel(sheet, lvl(2, barbarian, 2), 12, 19).hp.current).toBe(5);
  });
  it("trata unos PG actuales sin guardar como al máximo", () => {
    const sheet = sheetOf([lvl(1, barbarian, 1)], { current: null });
    expect(applyLevel(sheet, lvl(2, barbarian, 2), 12, 19).hp.current).toBe(19);
  });
  it("añade las maestrías del nivel, partiendo de las del historial si la hoja no las guardaba", () => {
    const axe = ref("item:greataxe|xphb");
    const sword = ref("item:longsword|xphb");
    const first = lvl(1, barbarian, 1, [{ type: "weaponMastery", source: "s", value: [axe] }]);
    const sheet = sheetOf([first], { current: 12 });
    const next = applyLevel(sheet, lvl(2, barbarian, 2, [{ type: "weaponMastery", source: "s", value: [sword] }]), 12, 19);
    expect(next.weaponMasteries).toEqual([axe, sword]);
  });
  it("no toca las maestrías si el nivel no añade ninguna", () => {
    const sheet = sheetOf([lvl(1, barbarian, 1)], { current: 12 });
    expect("weaponMasteries" in applyLevel(sheet, lvl(2, barbarian, 2), 12, 19)).toBe(false);
  });
});

describe("removeLastLevel", () => {
  it("no borra el nivel 1", () => {
    const r = removeLastLevel(sheetOf([lvl(1, barbarian, 1)], { current: 12 }), 12);
    expect(r).toEqual({ ok: false, error: "El nivel 1 no se puede borrar." });
  });
  it("quita el último nivel, recalcula el resumen y recorta los PG", () => {
    const sheet = sheetOf([lvl(1, barbarian, 1), lvl(2, cleric, 1)], { current: 19 });
    const r = removeLastLevel(sheet, 12);
    expect(r.ok && r.sheet.levels).toHaveLength(1);
    expect(r.ok && r.sheet.classesSummary.map((c) => c.class.name)).toEqual(["Bárbaro"]);
    expect(r.ok && r.sheet.hp.current).toBe(12);
  });
  it("conserva los PG actuales por debajo del nuevo máximo", () => {
    const sheet = sheetOf([lvl(1, barbarian, 1), lvl(2, barbarian, 2)], { current: 4 });
    const r = removeLastLevel(sheet, 12);
    expect(r.ok && r.sheet.hp.current).toBe(4);
  });
  it("quita las maestrías que añadió el nivel, si siguen", () => {
    const axe = ref("item:greataxe|xphb");
    const sword = ref("item:longsword|xphb");
    const sheet = sheetOf(
      [lvl(1, barbarian, 1, [{ type: "weaponMastery", source: "s", value: [axe] }]),
        lvl(2, barbarian, 2, [{ type: "weaponMastery", source: "s", value: [sword] }])],
      { current: 12 },
      { weaponMasteries: [axe, sword] },
    );
    const r = removeLastLevel(sheet, 12);
    expect(r.ok && r.sheet.weaponMasteries).toEqual([axe]);
  });
  it("si la maestría del nivel ya se cambió por otra, recorta a las que permite la hoja sin el nivel", () => {
    const axe = ref("item:greataxe|xphb");
    const bow = ref("item:longbow|xphb");
    const sheet = sheetOf(
      [lvl(1, barbarian, 1, [{ type: "weaponMastery", source: "s", value: [axe] }]),
        lvl(2, barbarian, 2, [{ type: "weaponMastery", source: "s", value: [ref("item:longsword|xphb")] }])],
      { current: 12 },
      { weaponMasteries: [axe, bow] },
    );
    const r = removeLastLevel(sheet, 12, 1);
    expect(r.ok && r.sheet.weaponMasteries).toEqual([axe]);
    // Dentro del límite no recorta
    const kept = removeLastLevel(sheet, 12, 2);
    expect(kept.ok && kept.sheet.weaponMasteries).toEqual([axe, bow]);
  });
  it("quita los preparados por encima del nuevo máximo y límite (los últimos) y recorta los espacios gastados", () => {
    const spells = ["bless", "aid", "cure wounds", "sanctuary"].map((n) => ref(`spell:${n}|xphb`));
    const sheet = sheetOf([lvl(1, cleric, 1), lvl(2, cleric, 2), lvl(3, cleric, 3)], { current: 20 }, {
      prepared: { "class:cleric|xphb": spells },
      slotsUsed: { 1: 4, 2: 1 },
    });
    // Sin el nivel: límite 2, máximo nivel 1 y 3 espacios de nivel 1
    const block = { class: cleric.ref, mode: "list", preparedLimit: 2, maxSpellLevel: 1, spellbook: [] } as unknown as CasterBlock;
    const levelOf = (r: { key: string }) => (r.key === "spell:aid|xphb" ? 2 : 1);
    const r = removeLastLevel(sheet, 12, Infinity, { blocks: [block], slots: { levels: { 1: 3 }, pact: null }, spellLevel: levelOf });
    expect(r.ok && r.sheet.prepared).toEqual({ "class:cleric|xphb": [spells[0], spells[2]] });
    expect(r.ok && r.sheet.slotsUsed).toEqual({ 1: 3 });
  });
  it("al borrar el nivel que dio la subclase, quita su alternativa de conjuros elegida", () => {
    const druid = cls("class:druid|xphb", "Druida");
    const land = ref("subclass:circle of the land|druid|xphb");
    const sheet = sheetOf(
      [lvl(1, druid, 1), lvl(2, druid, 2), lvl(3, druid, 3, [{ type: "subclass", source: "class:subclass", value: { ref: land, name: "Tierra" } }])],
      { current: 20 }, { spellOption: { [land.key]: "Polar Land", otra: "Arid Land" } },
    );
    const r = removeLastLevel(sheet, 12);
    expect(r.ok && r.sheet.spellOption).toEqual({ otra: "Arid Land" });
    // Otro nivel no la toca
    const later = sheetOf([...sheet.levels, lvl(4, druid, 4)], { current: 20 }, { spellOption: { [land.key]: "Polar Land" } });
    const kept = removeLastLevel(later, 12);
    expect(kept.ok && kept.sheet.spellOption).toEqual({ [land.key]: "Polar Land" });
  });
  it("sin datos de conjuros no toca los preparados", () => {
    const sheet = sheetOf([lvl(1, cleric, 1), lvl(2, cleric, 2)], { current: 12 }, { prepared: { x: [] }, slotsUsed: { 1: 1 } });
    const r = removeLastLevel(sheet, 12);
    expect(r.ok && [r.sheet.prepared, r.sheet.slotsUsed]).toEqual([{ x: [] }, { 1: 1 }]);
  });
});

describe("checkExpectedLevel", () => {
  it("acepta el nivel actual + 1", () => expect(checkExpectedLevel(4, 3)).toEqual({ ok: true }));
  it("409 si no coincide, también en 0 y 20", () => {
    for (const [e, c] of [[3, 3], [5, 3], [20, 20], [2, 0]] as const)
      expect(checkExpectedLevel(e, c)).toMatchObject({ ok: false, status: 409 });
  });
  it("400 si no es un entero", () => {
    for (const e of ["4", 4.5, null, undefined, NaN]) expect(checkExpectedLevel(e, 3)).toMatchObject({ ok: false, status: 400 });
  });
});
