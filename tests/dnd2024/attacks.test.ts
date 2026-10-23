import { describe, expect, it } from "vitest";
import { unarmedAttack, weaponAttack } from "@/lib/rules/dnd2024/derive/attacks";
import type { Ability, ItemData } from "@/lib/rules/types";

const mods = (m: Partial<Record<Ability, number>>): Record<Ability, number> =>
  ({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, ...m });
const weapon = (
  name: string, type: string, damage: string, damageType: string, properties: string[], category: string, mastery?: string,
): ItemData & { name: string } => ({
  name, type, weight: 1, value: 0,
  weapon: { damage, damageType, properties, category, ...(mastery ? { mastery } : {}) },
});

const greataxe = weapon("Hacha a dos manos", "M", "1d12", "S", ["H", "2H"], "martial", "cleave");
const rapier = weapon("Estoque", "M", "1d8", "P", ["F"], "martial", "vex");
const longbow = weapon("Arco largo", "R", "1d8", "P", ["A", "H", "2H"], "martial", "slow");
const longsword = weapon("Espada larga", "M", "1d8", "S", ["V"], "martial", "sap");

describe("weaponAttack", () => {
  it("hacha a dos manos con FUE 17 y competencia", () => {
    const a = weaponAttack(greataxe, mods({ str: 3 }), 2, true, false);
    expect(a.bonus).toBe(5);
    expect(a.damage).toBe("1d12+3");
    expect(a.damageType).toBe("cortante");
    expect(a.properties).toEqual(["Pesada", "A dos manos"]);
    expect(a.name).toBe("Hacha a dos manos");
  });
  it("sin competencia no suma el bonificador", () => {
    expect(weaponAttack(greataxe, mods({ str: 3 }), 2, false, false).bonus).toBe(3);
  });
  it("arma sutil usa la mejor de FUE y DES", () => {
    const a = weaponAttack(rapier, mods({ str: 0, dex: 3 }), 2, true, false);
    expect(a.bonus).toBe(5);
    expect(a.damage).toBe("1d8+3");
    expect(weaponAttack(rapier, mods({ str: 4, dex: 3 }), 2, true, false).damage).toBe("1d8+4");
  });
  it("arma a distancia usa DES", () => {
    const a = weaponAttack(longbow, mods({ str: 4, dex: 2 }), 2, true, false);
    expect(a.bonus).toBe(4);
    expect(a.damage).toBe("1d8+2");
    expect(a.damageType).toBe("perforante");
  });
  it("versátil muestra los dos dados", () => {
    expect(weaponAttack(longsword, mods({ str: 3 }), 2, true, false).damage).toBe("1d8+3 / 1d10+3 (dos manos)");
  });
  it("modificador negativo o nulo", () => {
    expect(weaponAttack(greataxe, mods({ str: -1 }), 2, true, false).damage).toBe("1d12-1");
    expect(weaponAttack(greataxe, mods({}), 2, true, false).damage).toBe("1d12");
  });
  it("maestría solo si el personaje la tiene", () => {
    expect(weaponAttack(greataxe, mods({ str: 3 }), 2, true, true).mastery).toBe("Hendir");
    expect(weaponAttack(greataxe, mods({ str: 3 }), 2, true, false).mastery).toBeNull();
  });
});

describe("unarmedAttack", () => {
  it("1 + FUE contundente, con competencia", () => {
    const a = unarmedAttack(mods({ str: 2, dex: 3 }), 2, null);
    expect(a).toMatchObject({ bonus: 4, damage: "3", damageType: "contundente", mastery: null });
  });
  it("Monje: dado de Artes marciales y la mejor de FUE y DES", () => {
    const a = unarmedAttack(mods({ str: 1, dex: 3 }), 2, "1d6");
    expect(a.bonus).toBe(5);
    expect(a.damage).toBe("1d6+3");
  });
});
