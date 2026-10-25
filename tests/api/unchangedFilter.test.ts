import { describe, expect, it } from "vitest";
import { Character } from "@/lib/models/Character";
import { unchangedFilter } from "@/lib/utils/unchangedFilter";

// Filtro tal como lo envía Mongoose a la base de datos (sin conexión)
const cast = (value: unknown) =>
  Character.where({ "sheet.field": unchangedFilter(value) }).cast(Character) as Record<string, unknown>;

describe("unchangedFilter", () => {
  it("sin valor guardado: el campo no existe", () => {
    expect(cast(undefined)).toEqual({ "sheet.field": { $exists: false } });
  });

  it.each([
    ["array vacío", []],
    ["array con un elemento", [{ ref: { book: "b", key: "spell:x|xphb" }, name: "X" }]],
    ["objeto vacío", {}],
    ["objeto con un array", { "class:wizard|xphb": [{ book: "b", key: "spell:x|xphb" }] }],
  ])("%s: igualdad exacta, nunca $in", (_, value) => {
    const filter = cast(value);
    expect(JSON.stringify(filter)).not.toContain("$in");
    expect(filter).toEqual({ "sheet.field": { $eq: value } });
  });

  it("el array suelto sí se convertiría en $in (por eso hace falta)", () => {
    expect(JSON.stringify(Character.where({ "sheet.field": [] }).cast(Character))).toContain("$in");
  });
});
