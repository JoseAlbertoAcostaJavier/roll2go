import { describe, expect, it } from "vitest";
import { unarmedAttack, weaponAttack, weaponProficient } from "@/lib/rules/dnd2024/derive/attacks";
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
const shortsword = weapon("Espada corta", "M", "1d6", "P", ["F", "L"], "martial", "vex");
const spear = weapon("Lanza", "M", "1d6", "P", ["T", "V"], "simple", "sap");

describe("weaponProficient", () => {
  // Así quedan en el catálogo las competencias de armas del Pícaro y el Monje de 2024
  const rogue = ["simple", "Martial weapons that have the Finesse or Light property"];
  const monk = ["simple", "Martial weapons that have the Light property"];
  it("por categoría o por el arma concreta", () => {
    expect(weaponProficient(greataxe, ["Hacha a dos manos", "greataxe"], ["simple", "martial"])).toBe(true);
    expect(weaponProficient(greataxe, ["Hacha a dos manos", "greataxe"], ["simple"])).toBe(false);
    expect(weaponProficient(rapier, ["Estoque", "rapier"], ["simple", "rapier"])).toBe(true);
  });
  it("Pícaro: armas marciales sutiles o ligeras", () => {
    expect(weaponProficient(rapier, ["Estoque", "rapier"], rogue)).toBe(true);
    expect(weaponProficient(shortsword, ["Espada corta", "shortsword"], rogue)).toBe(true);
    expect(weaponProficient(longsword, ["Espada larga", "longsword"], rogue)).toBe(false);
  });
  it("Monje: armas marciales ligeras", () => {
    expect(weaponProficient(shortsword, ["Espada corta", "shortsword"], monk)).toBe(true);
    expect(weaponProficient(longsword, ["Espada larga", "longsword"], monk)).toBe(false);
    expect(weaponProficient(rapier, ["Estoque", "rapier"], monk)).toBe(false);
    expect(weaponProficient(spear, ["Lanza", "spear"], monk)).toBe(true);
  });
});

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
  it("Monje con arma de monje: la mejor de FUE y DES y el dado mayor", () => {
    const a = weaponAttack(spear, mods({ str: 1, dex: 3 }), 2, true, false, "1d8");
    expect(a.bonus).toBe(5);
    expect(a.damage).toBe("1d8+3 / 1d8+3 (dos manos)");
    // El dado del arma si es mayor que el de Artes marciales
    expect(weaponAttack(spear, mods({ str: 1, dex: 3 }), 2, true, false, "1d4").damage).toBe("1d6+3 / 1d8+3 (dos manos)");
    expect(weaponAttack(shortsword, mods({ str: 3, dex: 1 }), 2, true, false, "1d8").damage).toBe("1d8+3");
  });
  it("Monje con un arma que no es de monje: como cualquier otro", () => {
    expect(weaponAttack(longsword, mods({ str: 1, dex: 3 }), 2, true, false, "1d10").damage).toBe("1d8+1 / 1d10+1 (dos manos)");
    expect(weaponAttack(greataxe, mods({ str: 1, dex: 3 }), 2, true, false, "1d8").damage).toBe("1d12+1");
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
