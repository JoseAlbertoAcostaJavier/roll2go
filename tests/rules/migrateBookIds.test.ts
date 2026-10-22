import { describe, expect, test } from "vitest";
import { convertBookIds } from "@/lib/rules/migrateBookIds";

const XPHB = "64b7f0f0f0f0f0f0f0f0f0a1";
const idByKey = new Map([["XPHB", XPHB]]);
const other = "64b7f0f0f0f0f0f0f0f0f0b2";

describe("convertBookIds", () => {
  test("sustituye un id antiguo por el del libro oficial", () => {
    expect(convertBookIds(["dnd-2024-phb"], idByKey)).toEqual({ ids: [XPHB], dropped: [] });
  });
  test("deja los ObjectId válidos", () => {
    expect(convertBookIds([other], idByKey)).toEqual({ ids: [other], dropped: [] });
  });
  test("descarta y comunica los ids antiguos sin libro oficial", () => {
    expect(convertBookIds(["dnd-2024-dmg", "basura"], idByKey)).toEqual({
      ids: [],
      dropped: ["dnd-2024-dmg", "basura"],
    });
  });
  test("elimina duplicados", () => {
    expect(convertBookIds(["dnd-2024-phb", XPHB, XPHB], idByKey).ids).toEqual([XPHB]);
  });
  test("es idempotente con datos ya migrados", () => {
    const first = convertBookIds(["dnd-2024-phb", other], idByKey);
    expect(convertBookIds(first.ids, idByKey)).toEqual({ ids: first.ids, dropped: [] });
  });
});
