import { describe, expect, it } from "vitest";
import { makeBreakdown } from "@/lib/rules/dnd2024/derive/breakdown";
import { attackVariants, weaponAttack } from "@/lib/rules/dnd2024/derive/attacks";
import { bonusParts, itemIsActive, weaponMagic, withItemScores, withItemSpeed } from "@/lib/rules/dnd2024/derive/itemEffects";
import { attunementLines, type ItemInfo } from "@/lib/rules/dnd2024/sheet/inventoryTable";
import type { InventoryItem } from "@/lib/rules/dnd2024/sheet/sheet";
import { itemMagic } from "@/lib/rules/import/normalize";
import { ABILITIES, type Ability, type ItemData } from "@/lib/rules/types";

const item = (extra: Partial<ItemData>): ItemData => ({ type: "W", weight: 0, value: 0, ...extra });
const armor = { ac: 11, dexCap: null, stealthDisadvantage: false, category: "light" };
const sword = { damage: "1d8", damageType: "S", properties: [] as string[], category: "martial" };
const mods = { str: 3, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };

describe("itemMagic", () => {
  it("lee sintonización y bonificadores de 5etools", () => {
    expect(itemMagic({ reqAttune: true, bonusAc: "+1", bonusSavingThrow: "+1" })).toEqual({ attunement: true, bonuses: { ac: 1, saves: 1 } });
    expect(itemMagic({ reqAttune: "by a wizard", bonusSpellAttack: "+2", bonusSpellSaveDc: "+2" }))
      .toEqual({ attunement: true, bonuses: { spellAttack: 2, spellDc: 2 } });
    expect(itemMagic({ bonusWeapon: "+1" })).toEqual({ bonuses: { attack: 1, damage: 1 } });
    expect(itemMagic({ reqAttune: true, ability: { static: { str: 21 } } })).toEqual({ attunement: true, bonuses: { setScores: { str: 21 } } });
    expect(itemMagic({ reqAttune: true, ability: { con: 2 } })).toEqual({ attunement: true, bonuses: { addScores: { con: 2 } } });
  });
  it("no toma lo que no puede aplicar la ficha", () => {
    expect(itemMagic({ name: "Cuerda" })).toEqual({});
    // Un manual suma al leerlo, no por llevarlo
    expect(itemMagic({ ability: { con: 2 } })).toEqual({});
    expect(itemMagic({ modifySpeed: { multiply: { walk: 2 } } })).toEqual({});
    expect(itemMagic({ reqAttune: true, modifySpeed: { static: { walk: 30 } } })).toEqual({ attunement: true, bonuses: { walk: 30 } });
  });
});

describe("itemIsActive", () => {
  const ring = item({ attunement: true });
  it("con sintonización, solo sintonizado", () => {
    expect(itemIsActive({ equipped: true }, ring)).toBe(false);
    expect(itemIsActive({ attuned: true }, ring)).toBe(true);
  });
  it("las armas y armaduras con sintonización, además equipadas", () => {
    expect(itemIsActive({ attuned: true }, item({ attunement: true, armor }))).toBe(false);
    expect(itemIsActive({ attuned: true, equipped: true }, item({ attunement: true, armor }))).toBe(true);
  });
  it("sin sintonización, al equiparlo", () => {
    expect(itemIsActive({}, item({}))).toBe(false);
    expect(itemIsActive({ equipped: true }, item({}))).toBe(true);
  });
});

describe("efectos en la ficha", () => {
  const scores = (v: number) => Object.fromEntries(ABILITIES.map((a) => [a, makeBreakdown([{ label: "Base", value: v }])])) as Record<Ability, ReturnType<typeof makeBreakdown>>;

  it("una puntuación fija solo si mejora la del personaje, y la mayor de ellas", () => {
    const active = [
      { name: "Cinturón A", data: item({ bonuses: { setScores: { str: 21 } } }) },
      { name: "Cinturón B", data: item({ bonuses: { setScores: { str: 25 } } }) },
    ];
    const out = withItemScores(scores(14), active);
    expect(out.str.total).toBe(25);
    expect(out.str.parts.at(-1)).toEqual({ label: "Cinturón B", value: 11 });
    expect(out.str.notes).toEqual(["Modificador +7"]);
    expect(withItemScores(scores(26), active).str.total).toBe(26);
  });
  it("una suma llega como mucho a 20", () => {
    const active = [{ name: "Piedra", data: item({ bonuses: { addScores: { dex: 2 } } }) }];
    expect(withItemScores(scores(19), active).dex.total).toBe(20);
    expect(withItemScores(scores(20), active).dex.total).toBe(20);
    expect(withItemScores(scores(20), active).dex.parts).toHaveLength(1);
  });
  it("cada objeto sale con su nombre en el desglose", () => {
    expect(bonusParts([{ name: "Capa", data: item({ bonuses: { ac: 1 } }) }, { name: "Cuerda", data: item({}) }], "ac")).toEqual([{ label: "Capa", value: 1 }]);
  });
  it("la velocidad fija solo si es mayor", () => {
    const active = [{ name: "Botas", data: item({ bonuses: { walk: 30 } }) }];
    expect(withItemSpeed(makeBreakdown([{ label: "Base", value: 25 }]), active).total).toBe(30);
    expect(withItemSpeed(makeBreakdown([{ label: "Base", value: 35 }]), active).total).toBe(35);
  });
  it("el arma suma al ataque y al daño; la otra mano conserva solo lo mágico", () => {
    const data = { ...item({ weapon: { ...sword, properties: ["L"] } }), name: "Espada +1" };
    const a = weaponAttack(data, mods, 2, true, false, null, { attack: 1, damage: 1 });
    expect(a.bonus).toBe(6);
    expect(a.damage).toBe("1d8+4");
    expect(attackVariants(a, data, 1).find((v) => v.variant === "offhand")?.damage).toBe("1d8+1");
  });
  it("la otra mano sin magia sigue como antes", () => {
    const data = { ...item({ weapon: { ...sword, properties: ["L"] } }), name: "Daga" };
    expect(attackVariants(weaponAttack(data, mods, 2, true, false), data).find((v) => v.variant === "offhand")?.damage).toBe("1d8");
    const weak = weaponAttack(data, { ...mods, str: -1 }, 2, true, false);
    expect(attackVariants(weak, data).find((v) => v.variant === "offhand")?.damage).toBe("1d8-1");
  });
  it("un arma con sintonización sin sintonizar no da bonificador", () => {
    const d = item({ attunement: true, bonuses: { attack: 2, damage: 2 } });
    expect(weaponMagic({ equipped: true }, d)).toEqual({});
    expect(weaponMagic({ attuned: true }, d)).toEqual({ attack: 2, damage: 2 });
    expect(weaponMagic({ equipped: true }, item({ bonuses: { attack: 1, damage: 1 } }))).toEqual({ attack: 1, damage: 1 });
  });
});

describe("lista de sintonización", () => {
  const line = (id: string, attuned = false) => ({ id, name: id, quantity: 1, attuned }) as unknown as InventoryItem;
  const info = (attunement: boolean) => ({ attunement, rarity: "rare" }) as unknown as ItemInfo;
  it("solo los que la requieren y los ya sintonizados", () => {
    const items = [line("capa"), line("poción"), line("antiguo", true)];
    expect(attunementLines(items, { capa: info(true), "poción": info(false), antiguo: info(false) }).map((l) => l.id)).toEqual(["capa", "antiguo"]);
  });
});
