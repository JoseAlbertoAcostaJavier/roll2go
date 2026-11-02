import { describe, expect, it } from "vitest";
import { castOptions } from "@/lib/rules/dnd2024/spells/castOptions";
import type { SpellRow } from "@/lib/rules/dnd2024/spells/spellTable";

const row = (level: number, over: Partial<SpellRow> = {}): SpellRow => ({
  ref: { book: "b", key: "spell:x|xphb" }, key: "b:spell:x|xphb", name: "X", nameEn: "X", level, school: "V",
  time: "1 acción", timeShort: "1 A", range: "", duration: "", components: "", concentration: false, ritual: false,
  hit: null, effect: null, origin: "Mago", limited: null, casterClass: null, tags: [], ...over,
});
const slots = { levels: { "1": 2, "2": 1, "3": 1 }, pact: null };
const labels = (o: ReturnType<typeof castOptions>) => o.map((x) => x.label);

describe("castOptions", () => {
  it("nivel propio y superiores con espacios libres", () => {
    expect(labels(castOptions(row(1), slots, { "1": 1 }))).toEqual(["Nivel 1", "Nivel 2", "Nivel 3"]);
  });
  it("sin espacios del nivel, empieza por el siguiente libre", () => {
    const o = castOptions(row(1), slots, { "1": 2 });
    expect(labels(o)).toEqual(["Nivel 2", "Nivel 3"]);
    expect(o[0]).toEqual({ kind: "slot", level: "2", label: "Nivel 2" });
  });
  it("incluye el pacto si su nivel llega", () => {
    const o = castOptions(row(1), { levels: {}, pact: { count: 2, level: 2 } }, { pact: 1 });
    expect(o).toEqual([{ kind: "slot", level: "pact", label: "Magia de pacto (nivel 2)" }]);
    expect(castOptions(row(3), { levels: {}, pact: { count: 2, level: 2 } }, {})).toEqual([]);
    expect(castOptions(row(1), { levels: {}, pact: { count: 1, level: 2 } }, { pact: 1 })).toEqual([]);
  });
  it("ritual al final y solo si no hay espacios", () => {
    const o = castOptions(row(1, { ritual: true }), { levels: {}, pact: null }, {});
    expect(o).toEqual([{ kind: "ritual", label: "Lanzar como ritual" }]);
    expect(labels(castOptions(row(2, { ritual: true }), slots, {}))).toEqual(["Nivel 2", "Nivel 3", "Lanzar como ritual"]);
  });
  it("trucos y limitados no tienen opciones", () => {
    expect(castOptions(row(0), slots, {})).toEqual([]);
    expect(castOptions(row(1, { limited: { key: "k", max: 1, used: 0 } }), slots, {})).toEqual([]);
  });
  it("brujo multiclase: espacios normales y pacto a la vez", () => {
    const mixed = { levels: { "1": 2, "2": 1 }, pact: { count: 2, level: 2 } };
    expect(labels(castOptions(row(1), mixed, { "1": 2 }))).toEqual(["Nivel 2", "Magia de pacto (nivel 2)"]);
    expect(labels(castOptions(row(1, { ritual: true }), mixed, { "1": 2 }))).toEqual([
      "Nivel 2", "Magia de pacto (nivel 2)", "Lanzar como ritual",
    ]);
  });
});
