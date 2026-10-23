import { describe, expect, it } from "vitest";
import { parseBbcode } from "@/lib/bbcode";
import { entriesToBbcode, inlineTags } from "@/lib/rules/import/toBbcode";

describe("inlineTags", () => {
  it("convierte negrita y cursiva", () => {
    expect(inlineTags("{@b Hola} y {@i tú}")).toBe("[b]Hola[/b] y [i]tú[/i]");
  });
  it("convierte referencias", () => {
    expect(inlineTags("{@spell Fireball|XPHB}")).toBe("[ref=spell:fireball|xphb]Fireball[/ref]");
    expect(inlineTags("{@item Handaxe|XPHB|Handaxes}")).toBe("[ref=item:handaxe|xphb]Handaxes[/ref]");
    expect(inlineTags("{@condition Blinded}")).toBe("[ref=condition:blinded|xphb]Blinded[/ref]");
    expect(inlineTags("{@condition Blinded||ciego}")).toBe("[ref=condition:blinded|xphb]ciego[/ref]");
  });
  it("filter, book y 5etools muestran siempre el primer segmento", () => {
    expect(inlineTags("{@filter trucos|spells|level=0|class=Wizard}")).toBe("[ref=filter:trucos|spells]trucos[/ref]");
    expect(inlineTags("{@book capítulo 7|XPHB|7}")).toBe("[ref=book:capítulo 7|xphb]capítulo 7[/ref]");
    expect(inlineTags("{@5etools tabla|tables.html|extra}")).toBe("[ref=5etools:tabla|tables.html]tabla[/ref]");
  });
  it("destaca dados y CD", () => {
    expect(inlineTags("{@dice 1d8} y {@dc 15}")).toBe("[b]1d8[/b] y [b]CD 15[/b]");
    expect(inlineTags("{@damage 2d6|fuego}")).toBe("[b]fuego[/b]");
    expect(inlineTags("{@chance 25}")).toBe("[b]25 %[/b]");
  });
  it("etiquetas desconocidas quedan como texto plano", () => {
    expect(inlineTags("{@desconocida algo|X}")).toBe("algo");
  });
  it("resuelve etiquetas anidadas", () => {
    expect(inlineTags("{@b ver {@spell Fireball|XPHB}}")).toBe("[b]ver [ref=spell:fireball|xphb]Fireball[/ref][/b]");
  });
  it("no se cuelga con llaves sin cerrar", () => {
    expect(inlineTags("{@b sin cerrar")).toBe("{@b sin cerrar");
  });
  it("el resultado se puede parsear", () => {
    const nodes = parseBbcode(inlineTags("{@spell Fireball|XPHB}"));
    expect(nodes[0]).toMatchObject({ type: "ref", target: "spell:fireball|xphb" });
  });
});

describe("entriesToBbcode", () => {
  it("párrafos y listas", () => {
    expect(entriesToBbcode(["Uno", { type: "list", items: ["a", "b"] }])).toBe(
      "Uno\n\n[list]\n[*]a\n[*]b\n[/list]",
    );
  });
  it("entries con nombre", () => {
    expect(entriesToBbcode([{ type: "entries", name: "Rasgo", entries: ["Texto"] }])).toBe("[b]Rasgo.[/b] Texto");
  });
  it("elementos de lista con nombre", () => {
    expect(entriesToBbcode([{ type: "list", items: [{ type: "item", name: "Fuerza", entries: ["Mucha"] }] }])).toBe(
      "[list]\n[*][b]Fuerza.[/b] Mucha\n[/list]",
    );
  });
  it("tablas como líneas", () => {
    expect(
      entriesToBbcode([{ type: "table", colLabels: ["d6", "Efecto"], rows: [["1", "Nada"], [{ type: "cell", roll: { min: 2, max: 6 } }, "Algo"]] }]),
    ).toBe("[b]d6 · Efecto[/b]\n1 · Nada\n2-6 · Algo");
  });
  it("inset y quote muestran su contenido", () => {
    expect(entriesToBbcode([{ type: "inset", entries: ["Dentro"] }])).toBe("Dentro");
    expect(entriesToBbcode([{ type: "quote", entries: ["Cita"], by: "Alguien" }])).toBe("[i]Cita[/i]\n— Alguien");
  });
  it("referencias de rasgos no generan nada", () => {
    expect(entriesToBbcode(["A", { type: "refClassFeature", classFeature: "x|y|z" }, "B"])).toBe("A\n\nB");
  });
  it("abilityDc y abilityAttackMod", () => {
    expect(entriesToBbcode([{ type: "abilityDc", name: "Spellcasting", attributes: ["wis"] }])).toBe(
      "CD de salvación de conjuros = 8 + bonificador de competencia + modificador de Sabiduría",
    );
    expect(entriesToBbcode([{ type: "abilityAttackMod", name: "Spellcasting", attributes: ["int", "cha"] }])).toBe(
      "Modificador de ataque de conjuros = bonificador de competencia + modificador de Inteligencia o Carisma",
    );
  });
  it("tipos desconocidos: sus entries o nada", () => {
    expect(entriesToBbcode([{ type: "raro", entries: ["Hola"] }, { type: "raro2" }])).toBe("Hola");
  });
});
