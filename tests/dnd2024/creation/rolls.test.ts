import { beforeAll, describe, expect, it } from "vitest";
import {
  hitDieValue, rollAbilityScoresDetailed, signHitDie, signRolls, verifyHitDie, verifyRolls, type HitDieRoll,
} from "@/lib/rules/dnd2024/creation/rolls";

const H = 3600 * 1000;
beforeAll(() => {
  process.env.AUTH_SECRET = "secreto-de-prueba";
});

describe("rolls", () => {
  const values = [15, 12, 9, 14, 8, 11];
  const now = 1_700_000_000_000;
  const token = () => signRolls("u1", values, now);

  it("acepta el token propio, en cualquier orden de valores", () => {
    expect(verifyRolls("u1", values, token(), now + H)).toBe(true);
    expect(verifyRolls("u1", [...values].reverse(), token(), now + H)).toBe(true);
  });
  it("rechaza otro usuario, otros valores y token caducado", () => {
    expect(verifyRolls("u2", values, token(), now + H)).toBe(false);
    expect(verifyRolls("u1", [18, 12, 9, 14, 8, 11], token(), now + H)).toBe(false);
    expect(verifyRolls("u1", values, token(), now + 25 * H)).toBe(false);
  });
  it("rechaza tokens mal formados o manipulados", () => {
    expect(verifyRolls("u1", values, "", now)).toBe(false);
    expect(verifyRolls("u1", values, "abc.def", now)).toBe(false);
    const sig = token().split(".")[1];
    expect(verifyRolls("u1", values, `${now + 1000 * H}.${sig}`, now)).toBe(false);
  });
});

describe("rollAbilityScoresDetailed", () => {
  it("seis tiradas de 4 dados; cada valor suma los 3 más altos", () => {
    let i = 0;
    const faces = [0, 0.99, 0.5, 0.2, 0.3, 0.7, 0.1, 0.9];
    const { values, dice } = rollAbilityScoresDetailed(() => faces[i++ % faces.length]);
    expect(values).toHaveLength(6);
    expect(dice).toHaveLength(6);
    // Los dados en el orden en que salen: 1, 6, 4, 2 → 12 (sin el 1)
    expect(dice[0]).toEqual([1, 6, 4, 2]);
    expect(values[0]).toBe(12);
    for (const [k, d] of dice.entries()) {
      expect(d).toHaveLength(4);
      expect(d.every((n) => n >= 1 && n <= 6)).toBe(true);
      expect(values[k]).toBe([...d].sort((a, b) => b - a).slice(0, 3).reduce((s, n) => s + n, 0));
    }
  });
  it("con Math.random también cuadra", () => {
    const { values, dice } = rollAbilityScoresDetailed();
    for (const [k, d] of dice.entries()) {
      expect(values[k]).toBe(d.reduce((s, n) => s + n, 0) - Math.min(...d));
    }
  });
});

describe("dado de golpe", () => {
  const now = 1_700_000_000_000;
  const roll = (over: Partial<HitDieRoll> = {}): HitDieRoll => ({ characterId: "c1", n: 4, die: 12, value: 9, ...over });

  it("acepta el token propio con el mismo personaje, nivel, dado y valor", () => {
    expect(verifyHitDie("u1", roll(), signHitDie("u1", roll(), now), now + H)).toBe(true);
  });
  it("rechaza otro usuario, otro personaje, otro nivel, otro valor, otro dado y token caducado", () => {
    const token = signHitDie("u1", roll(), now);
    expect(verifyHitDie("u2", roll(), token, now)).toBe(false);
    expect(verifyHitDie("u1", roll({ characterId: "c2" }), token, now)).toBe(false);
    expect(verifyHitDie("u1", roll({ n: 5 }), token, now)).toBe(false);
    expect(verifyHitDie("u1", roll({ value: 10 }), token, now)).toBe(false);
    expect(verifyHitDie("u1", roll({ die: 10 }), token, now)).toBe(false);
    expect(verifyHitDie("u1", roll(), token, now + 25 * H)).toBe(false);
  });
  it("rechaza valores fuera del dado aunque estén firmados, y dados que no existen", () => {
    for (const r of [roll({ value: 13 }), roll({ value: 0 }), roll({ die: 7, value: 3 })]) {
      expect(verifyHitDie("u1", r, signHitDie("u1", r, now), now)).toBe(false);
    }
  });
  it("un token de tiradas de característica no vale como dado de golpe", () => {
    expect(verifyHitDie("u1", roll(), signRolls("u1", [9], now), now)).toBe(false);
  });
  it("hitDieValue: la misma tirada da siempre el mismo valor, de 1 al dado", () => {
    expect(hitDieValue("u1", "c1", 4, 10)).toBe(hitDieValue("u1", "c1", 4, 10));
    for (const die of [6, 8, 10, 12]) {
      const seen = new Set<number>();
      for (let n = 2; n <= 200; n++) seen.add(hitDieValue("u1", `c${n}`, n % 20 + 1, die));
      expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: die }, (_, i) => i + 1));
    }
  });
  it("hitDieValue depende del usuario, el personaje, el nivel y el secreto", () => {
    const base = hitDieValue("u1", "c1", 4, 12);
    // Con 12 caras, al menos uno de varios cambios debe dar otro valor
    const others = [
      ...["u2", "u3", "u4"].map((u) => hitDieValue(u, "c1", 4, 12)),
      ...["c2", "c3", "c4"].map((c) => hitDieValue("u1", c, 4, 12)),
      ...[5, 6, 7].map((n) => hitDieValue("u1", "c1", n, 12)),
    ];
    expect(others.some((v) => v !== base)).toBe(true);
    const old = process.env.AUTH_SECRET;
    const values = (s: string) => {
      process.env.AUTH_SECRET = s;
      return Array.from({ length: 10 }, (_, n) => hitDieValue("u1", "c1", n + 2, 12));
    };
    expect(values("otro")).not.toEqual(values("secreto-de-prueba"));
    process.env.AUTH_SECRET = old;
  });
});
