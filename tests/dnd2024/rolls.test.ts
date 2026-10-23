import { beforeAll, describe, expect, it } from "vitest";
import { signRolls, verifyRolls } from "@/lib/rules/dnd2024/rolls";

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
