import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  spellClassNames, spellComponents, spellDuration, spellLevelLabel, spellRange, spellSchoolName, spellSummary, spellTags,
  spellTime,
} from "@/lib/rules/dnd2024/spells/spellText";
import * as client from "@/lib/rules/dnd2024/spells/spellTextClient";

describe("spellSchoolName", () => {
  test("letra de 5etools → escuela en español", () => {
    expect(spellSchoolName("V")).toBe("Evocación");
    expect(spellSchoolName("I")).toBe("Ilusionismo");
    expect(spellSchoolName("X")).toBe("X");
  });
});

describe("spellLevelLabel", () => {
  test("truco y niveles", () => {
    expect(spellLevelLabel(0)).toBe("Truco");
    expect(spellLevelLabel(3)).toBe("Nivel 3");
  });
});

describe("spellTime", () => {
  test("acciones, reacción con condición y minutos", () => {
    expect(spellTime([{ number: 1, unit: "action" }])).toBe("1 acción");
    expect(spellTime([{ number: 1, unit: "bonus" }])).toBe("1 acción adicional");
    expect(spellTime([{ number: 1, unit: "reaction", condition: "which you take when you see a creature casting" }]))
      .toBe("1 reacción");
    expect(spellTime([{ number: 10, unit: "minute" }])).toBe("10 minutos");
    expect(spellTime([{ number: 1, unit: "hour" }])).toBe("1 hora");
  });
});

describe("spellRange", () => {
  test("distancia en metros y pies", () => {
    expect(spellRange({ type: "point", distance: { type: "feet", amount: 60 } })).toBe("18 metros (60 pies)");
    expect(spellRange({ type: "point", distance: { type: "feet", amount: 15 } })).toBe("4,5 metros (15 pies)");
    expect(spellRange({ type: "point", distance: { type: "miles", amount: 1 } })).toBe("1,5 kilómetros (1 milla)");
  });
  test("toque, personal y áreas centradas en el lanzador", () => {
    expect(spellRange({ type: "point", distance: { type: "touch" } })).toBe("Toque");
    expect(spellRange({ type: "point", distance: { type: "self" } })).toBe("Personal");
    expect(spellRange({ type: "cone", distance: { type: "feet", amount: 15 } })).toBe("Personal (cono de 4,5 metros)");
    expect(spellRange({ type: "special" })).toBe("Especial");
  });
});

describe("spellDuration", () => {
  test("instantáneo, concentración y hasta que se disipe", () => {
    expect(spellDuration([{ type: "instant" }])).toBe("Instantáneo");
    expect(spellDuration([{ type: "timed", duration: { type: "minute", amount: 1 }, concentration: true }]))
      .toBe("Concentración, hasta 1 minuto");
    expect(spellDuration([{ type: "timed", duration: { type: "hour", amount: 8 } }])).toBe("8 horas");
    expect(spellDuration([{ type: "permanent", ends: ["dispel", "trigger"] }])).toBe("Hasta que se disipe o se active");
  });
});

describe("spellComponents", () => {
  test("el material va tal cual", () => {
    expect(spellComponents({ v: true, s: true, m: "a bit of bat fur" })).toBe("V, S, M (a bit of bat fur)");
    expect(spellComponents({ v: true, m: { text: "a diamond worth 300+ GP", cost: 30000, consume: true } }))
      .toBe("V, M (a diamond worth 300+ GP)");
  });
});

describe("spellTags", () => {
  test("daño, salvación, ataque, área, concentración y ritual", () => {
    const tags = spellTags({
      damageInflict: ["fire", "necrotic"], savingThrow: ["dexterity"], spellAttack: ["R"], areaTags: ["N", "ST"],
      conditionInflict: ["charmed"], miscTags: ["HL", "UA", "XX"], meta: { ritual: true },
      duration: [{ type: "timed", duration: { type: "minute", amount: 1 }, concentration: true }],
    });
    expect(tags).toEqual(expect.arrayContaining([
      "Daño de fuego", "Daño necrótico", "Salvación de Destreza", "Ataque de conjuro", "Área: cono", "Estado: hechizado", "Curación",
      "Concentración", "Ritual",
    ]));
    // Los códigos desconocidos, los de «usa una acción» y los de un solo objetivo no se convierten en etiqueta
    expect(tags).not.toContain("XX");
    expect(tags).toHaveLength(9);
    expect(tags.filter((t) => t.startsWith("Área"))).toEqual(["Área: cono"]);
  });
});

describe("spellSummary", () => {
  test("primer párrafo en texto plano, recortado", () => {
    expect(spellSummary("You hurl a [b]mote[/b] of [ref=x]fire[/ref].\n\nSecond paragraph.")).toBe("You hurl a mote of fire.");
    expect(spellSummary("")).toBe("");
    const long = spellSummary("a ".repeat(200));
    expect(long.length).toBeLessThanOrEqual(200);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("spellClassNames", () => {
  test("clases en español; las subclases se omiten y las desconocidas se dejan con mayúscula", () => {
    expect(spellClassNames(["wizard", "subclass:life-domain", "sorcerer", "mystic"]))
      .toEqual(["Mago", "Hechicero", "Mystic"]);
  });

  test("clases de otros libros que no están en es.json (Artífice)", () => {
    expect(spellClassNames(["artificer", "wizard"])).toEqual(["Artífice", "Mago"]);
  });
});

describe("spellTextClient: sin es.json en el navegador", () => {
  test("no importa es.json y da lo mismo que la parte de servidor", () => {
    expect(readFileSync(join(process.cwd(), "lib/rules/dnd2024/spells/spellTextClient.ts"), "utf8")).not.toContain("i18n/es.json");
    expect(client.spellSchoolName("V")).toBe(spellSchoolName("V"));
    expect(client.spellLevelLabel(0)).toBe("Truco");
    expect(client.spellTime([{ number: 1, unit: "bonus" }])).toBe("1 acción adicional");
  });

  test("ningún componente cliente importa spellText (que carga es.json)", () => {
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".tsx") || e.name.endsWith(".ts") ? [join(dir, e.name)] : []));
    const offenders = files(join(process.cwd(), "app/components"))
      .filter((f) => /dnd2024\/spellText"/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
