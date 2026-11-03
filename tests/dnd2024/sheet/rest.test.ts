import { describe, expect, it } from "vitest";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { FeatureUse } from "@/lib/rules/dnd2024/derive/featureUses";
import { applyRest, healingRange, hitDicePools, type RestCtx } from "@/lib/rules/dnd2024/sheet/rest";
import type { Dnd2024SheetV2, LevelEntry, Named } from "@/lib/rules/dnd2024/sheet/sheet";
import { B, buildCatalog, ref } from "../fixtureCatalog";

// Guerrero (d10) y Mago (d6) con nombre en español, como el catálogo real
const entries = buildCatalog(["class-fighter.json", "class-wizard.json", "class-warlock.json"]);
for (const [key, nameEs] of [["class:fighter|xphb", "Guerrero"], ["class:wizard|xphb", "Mago"], ["class:warlock|xphb", "Brujo"]]) {
  const e = entries.get(`${B}:${key}`)!;
  entries.set(`${B}:${key}`, { ...e, nameEs });
}
const FIGHTER = refKey(ref("class:fighter|xphb"));
const WIZARD = refKey(ref("class:wizard|xphb"));
const CLASSES: Record<string, Named> = {
  fighter: { ref: ref("class:fighter|xphb"), name: "Fighter" },
  wizard: { ref: ref("class:wizard|xphb"), name: "Wizard" },
  warlock: { ref: ref("class:warlock|xphb"), name: "Warlock" },
};

function sheetOf(path: string[], extra: Partial<Dnd2024SheetV2> = {}): Dnd2024SheetV2 {
  const count = new Map<string, number>();
  const levels: LevelEntry[] = path.map((id, i) => {
    count.set(id, (count.get(id) ?? 0) + 1);
    return { n: i + 1, class: CLASSES[id], classLevel: count.get(id)!, hp: { method: "average", value: 5 }, choices: [] };
  });
  return {
    version: 2,
    species: { ref: ref("species:elf|xphb"), name: "Elfo" },
    lineage: null,
    background: { ref: ref("background:none|xphb"), name: "Ninguno", abilities: {}, equipment: "A" },
    abilityMethod: "standard",
    baseAbilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
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
    hitDiceUsed: {},
    ...extra,
  };
}

const multi = (extra: Partial<Dnd2024SheetV2> = {}) => sheetOf(["fighter", "fighter", "fighter", "wizard"], extra);
const poolsOf = (s: Dnd2024SheetV2) => hitDicePools(s, entries);
const ctxOf = (s: Dnd2024SheetV2, over: Partial<RestCtx> = {}): RestCtx => ({
  pools: poolsOf(s), conMod: 0, maxHp: 12, roll: () => 1, featureUses: [], ...over,
});
const ok = (r: ReturnType<typeof applyRest>) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};
const errorOf = (r: ReturnType<typeof applyRest>) => (r.ok ? null : r.error);

describe("hitDicePools", () => {
  it("una por clase, en orden del historial, con su dado y sus niveles", () => {
    expect(poolsOf(multi())).toEqual([
      { classKey: FIGHTER, name: "Guerrero", die: 10, total: 3, used: 0 },
      { classKey: WIZARD, name: "Mago", die: 6, total: 1, used: 0 },
    ]);
  });
  it("los gastados no pasan del total", () => {
    const pools = poolsOf(multi({ hitDiceUsed: { [FIGHTER]: 5, [WIZARD]: 1 } }));
    expect(pools.map((p) => p.used)).toEqual([3, 1]);
  });
  it("una hoja sin hitDiceUsed cuenta 0 gastados", () => {
    const s = multi();
    delete (s as Partial<Dnd2024SheetV2>).hitDiceUsed;
    expect(poolsOf(s).map((p) => p.used)).toEqual([0, 0]);
  });
  it("una clase sin datos en el catálogo no aparece", () => {
    const pools = hitDicePools(multi(), new Map([...entries].filter(([k]) => k !== `${B}:class:wizard|xphb`)));
    expect(pools.map((p) => p.classKey)).toEqual([FIGHTER]);
  });
});

describe("healingRange", () => {
  it("suma el mínimo y el máximo de cada dado con el modificador, mínimo 1 por dado", () => {
    expect(healingRange([6, 6], 0)).toEqual({ min: 2, max: 12 });
    expect(healingRange([10, 6], 2)).toEqual({ min: 6, max: 20 });
    expect(healingRange([6], -3)).toEqual({ min: 1, max: 3 });
    expect(healingRange([], 2)).toEqual({ min: 0, max: 0 });
  });
});

describe("descanso corto con dados", () => {
  const hurt = (extra: Partial<Dnd2024SheetV2> = {}) => multi({ hp: { max: null, current: 3, temp: 2 }, ...extra });

  it("automático: tira cada dado, suma el modificador y gasta los dados", () => {
    const s = hurt();
    const r = ok(applyRest(s, { op: "shortRest", spend: { [FIGHTER]: 1 } }, ctxOf(s, { conMod: 2, roll: () => 4 })));
    expect(r.healed).toBe(6);
    expect(r.rolls).toEqual([4]);
    expect(r.sheet.hitDiceUsed).toEqual({ [FIGHTER]: 1 });
    expect(r.sheet.hp).toEqual({ max: null, current: 9, temp: 2 });
  });
  it("cada dado cura al menos 1", () => {
    const s = hurt();
    const r = ok(applyRest(s, { op: "shortRest", spend: { [WIZARD]: 1 } }, ctxOf(s, { conMod: -3, roll: () => 1 })));
    expect(r.healed).toBe(1);
    expect(r.rolls).toEqual([1]);
  });
  it("varias clases: tira cada dado con su cara y acumula lo gastado", () => {
    const s = hurt({ hitDiceUsed: { [FIGHTER]: 1 } });
    const seen: number[] = [];
    const roll = (die: number) => (seen.push(die), 2);
    const r = ok(applyRest(s, { op: "shortRest", spend: { [FIGHTER]: 2, [WIZARD]: 1 } }, ctxOf(s, { roll })));
    expect(seen).toEqual([10, 10, 6]);
    expect(r.healed).toBe(6);
    expect(r.sheet.hitDiceUsed).toEqual({ [FIGHTER]: 3, [WIZARD]: 1 });
  });
  it("los PG no pasan del máximo y al llegar quedan en null; los temporales no cambian", () => {
    const s = multi({ hp: { max: null, current: 5, temp: 3 } });
    const r = ok(applyRest(s, { op: "shortRest", spend: { [FIGHTER]: 1 }, healing: 10 }, ctxOf(s, { maxHp: 12 })));
    expect(r.sheet.hp).toEqual({ max: null, current: null, temp: 3 });
    expect(r.healed).toBe(7);
    const part = ok(applyRest(s, { op: "shortRest", spend: { [FIGHTER]: 1 }, healing: 4 }, ctxOf(s, { maxHp: 12 })));
    expect(part.sheet.hp.current).toBe(9);
  });
  it("automático: healed son los PG ganados, no la tirada (11/12 con 8 → 1)", () => {
    const s = multi({ hp: { max: null, current: 11, temp: 0 } });
    const r = ok(applyRest(s, { op: "shortRest", spend: { [FIGHTER]: 1 } }, ctxOf(s, { roll: () => 8 })));
    expect(r.healed).toBe(1);
    expect(r.rolls).toEqual([8]);
    expect(r.sheet.hp.current).toBeNull();
  });
  it("manual: acepta un total dentro del rango y no devuelve tiradas", () => {
    const s = hurt();
    const r = ok(applyRest(s, { op: "shortRest", spend: { [WIZARD]: 1 }, healing: 4 }, ctxOf(s)));
    expect(r.healed).toBe(4);
    expect(r.rolls).toEqual([]);
    expect(r.sheet.hitDiceUsed).toEqual({ [WIZARD]: 1 });
  });
  it("manual: 2d6 con modificador 0 va de 2 a 12", () => {
    const s = sheetOf(["wizard", "wizard"], { hp: { max: null, current: 3, temp: 0 } });
    const msg = "Con esos dados recuperas entre 2 y 12 puntos de golpe.";
    expect(errorOf(applyRest(s, { op: "shortRest", spend: { [WIZARD]: 2 }, healing: 13 }, ctxOf(s)))).toBe(msg);
    expect(errorOf(applyRest(s, { op: "shortRest", spend: { [WIZARD]: 2 }, healing: 1 }, ctxOf(s)))).toBe(msg);
    expect(errorOf(applyRest(s, { op: "shortRest", spend: { [WIZARD]: 2 }, healing: 2.5 }, ctxOf(s)))).toBe(msg);
    expect(applyRest(s, { op: "shortRest", spend: { [WIZARD]: 2 }, healing: 12 }, ctxOf(s)).ok).toBe(true);
  });
  it("healing sin dados gastados → error", () => {
    const s = hurt();
    expect(errorOf(applyRest(s, { op: "shortRest", healing: 3 }, ctxOf(s)))).not.toBeNull();
    expect(errorOf(applyRest(s, { op: "shortRest", spend: { [WIZARD]: 0 }, healing: 3 }, ctxOf(s)))).not.toBeNull();
  });
  it("gastar más de los libres → error con el nombre de la clase", () => {
    const s = multi({ hitDiceUsed: { [WIZARD]: 0 } });
    expect(errorOf(applyRest(s, { op: "shortRest", spend: { [WIZARD]: 2 } }, ctxOf(s))))
      .toBe("No te quedan tantos dados de golpe de Mago.");
    const spent = multi({ hitDiceUsed: { [WIZARD]: 1 } });
    expect(errorOf(applyRest(spent, { op: "shortRest", spend: { [WIZARD]: 1 } }, ctxOf(spent))))
      .toBe("No te quedan tantos dados de golpe de Mago.");
  });
  it("números no válidos → mismo error", () => {
    const s = multi();
    for (const n of [-1, 1.5, "1", null])
      expect(errorOf(applyRest(s, { op: "shortRest", spend: { [FIGHTER]: n } }, ctxOf(s))))
        .toBe("No te quedan tantos dados de golpe de Guerrero.");
  });
  it("clase desconocida → mismo error con el nombre crudo", () => {
    const s = multi();
    expect(errorOf(applyRest(s, { op: "shortRest", spend: { pirata: 1 } }, ctxOf(s))))
      .toBe("No te quedan tantos dados de golpe de pirata.");
  });
  it("con 0 dados recupera el pacto y los usos, y no toca los PG ni los dados", () => {
    const SIGNATURE = `signature:${B}:spell:fireball|xphb`;
    const ARCANUM = `arcanum:${B}:spell:circle of death|xphb`;
    const s = hurt({ slotsUsed: { pact: 2, 1: 1 }, limitedUsed: { [SIGNATURE]: 1, [ARCANUM]: 1 } });
    for (const op of [{ op: "shortRest" }, { op: "shortRest", spend: { [FIGHTER]: 0 } }]) {
      const r = ok(applyRest(s, op, ctxOf(s)));
      expect(r.sheet.slotsUsed).toEqual({ 1: 1 });
      expect(r.sheet.limitedUsed).toEqual({ [ARCANUM]: 1 });
      expect(r.sheet.hp).toEqual(s.hp);
      expect(r.sheet.hitDiceUsed).toEqual({});
      expect(r.healed).toBe(0);
      expect(r.rolls).toEqual([]);
    }
  });
  it("sin usos guardados no añade limitedUsed", () => {
    const s = hurt({ slotsUsed: { pact: 1 } });
    expect(ok(applyRest(s, { op: "shortRest" }, ctxOf(s))).sheet).not.toHaveProperty("limitedUsed");
  });
});

describe("descanso largo", () => {
  it("recupera dados, PG, temporales, espacios y usos", () => {
    const s = multi({
      hp: { max: 20, current: 3, temp: 4 }, hitDiceUsed: { [FIGHTER]: 2 },
      slotsUsed: { 1: 2, pact: 1 }, limitedUsed: { x: 1 },
    });
    const r = ok(applyRest(s, { op: "longRest" }, ctxOf(s)));
    expect(r.sheet.hitDiceUsed).toEqual({});
    expect(r.sheet.hp).toEqual({ max: 20, current: null, temp: 0 });
    expect(r.sheet.slotsUsed).toEqual({});
    expect(r.sheet.limitedUsed).toEqual({});
    expect(r.healed).toBe(0);
  });
  it("baja el agotamiento en 1, sin pasar de 0", () => {
    const run = (exhaustion: number) => {
      const s = multi({ exhaustion });
      return ok(applyRest(s, { op: "longRest" }, ctxOf(s))).sheet.exhaustion;
    };
    expect(run(2)).toBe(1);
    expect(run(0)).toBe(0);
  });
  it("no toca la inspiración ni los estados", () => {
    const s = multi({ heroicInspiration: true, conditions: ["poisoned"], exhaustion: 1 });
    const r = ok(applyRest(s, { op: "longRest" }, ctxOf(s)));
    expect(r.sheet.heroicInspiration).toBe(true);
    expect(r.sheet.conditions).toEqual(["poisoned"]);
  });
});

// Furia (2 usos, largo y 1 en corto), Recuperación arcana (1, solo largo) y Oleada de acción (1, todo en corto)
const usage = (key: string, max: number, used: number, short: FeatureUse["recovery"]["short"]): FeatureUse => ({
  key, name: key, max, used, recovery: { long: "all", short },
});
const uses = [usage("rage", 2, 2, 1), usage("arcane", 1, 1, "none"), usage("surge", 1, 1, "all")];
const usedOf = { rage: 2, arcane: 1, surge: 1 };

describe("usos de los rasgos", () => {
  it("el descanso largo los recupera todos", () => {
    const s = multi({ featureUses: usedOf });
    expect(ok(applyRest(s, { op: "longRest" }, ctxOf(s, { featureUses: uses }))).sheet.featureUses).toEqual({});
  });
  it("el corto recupera lo que dice cada rasgo", () => {
    const s = multi({ featureUses: usedOf });
    const r = ok(applyRest(s, { op: "shortRest" }, ctxOf(s, { featureUses: uses })));
    expect(r.sheet.featureUses).toEqual({ rage: 1, arcane: 1 });
  });
  it("un corto con 1 uso por recuperar y 1 gastado lo deja en 0 sin guardar la clave", () => {
    const s = multi({ featureUses: { rage: 1 } });
    const r = ok(applyRest(s, { op: "shortRest" }, ctxOf(s, { featureUses: [usage("rage", 2, 1, 1)] })));
    expect(r.sheet.featureUses).toEqual({});
  });
  it("una hoja sin featureUses no lo crea al descansar", () => {
    const s = multi();
    expect(ok(applyRest(s, { op: "longRest" }, ctxOf(s, { featureUses: uses }))).sheet).not.toHaveProperty("featureUses");
    expect(ok(applyRest(s, { op: "shortRest" }, ctxOf(s, { featureUses: uses }))).sheet).not.toHaveProperty("featureUses");
  });
});

describe("operación no válida", () => {
  it("rechaza lo que no es una operación de descanso", () => {
    const s = multi();
    expect(errorOf(applyRest(s, null, ctxOf(s)))).toBe("Petición no válida.");
    expect(errorOf(applyRest(s, { op: "nada" }, ctxOf(s)))).toBe("Operación no válida.");
  });
});
