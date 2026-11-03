import { describe, expect, it } from "vitest";
import type { ActionItem, ActionsSummary } from "@/lib/rules/dnd2024/derive/actions";
import type { Attack } from "@/lib/rules/dnd2024/derive";
import { actionFilterHref, actionSections, parseActionFilter, sectionVisibility } from "@/lib/rules/dnd2024/sheet/actionFilters";

const ref = (key: string) => ({ book: "b", key });
const attack: Attack = {
  name: "Espada larga", bonus: 5, damage: "1d8+3", damageType: "Cortante", properties: [], mastery: null,
  kind: "melee", range: "1,5 m", damageTypeId: "slashing",
};
const spell = (name: string, group: ActionItem["group"], hit: string | null): ActionItem => ({
  kind: "spell", group, ref: ref(`spell:${name}`), name, level: 0, school: "V", range: "18 m", hit, damage: null, damageTypeId: null, notes: "",
});
const summary: ActionsSummary = {
  attacksPerAction: 2,
  items: [
    { kind: "attack", group: "action", attack },
    spell("Rayo de escarcha", "action", "+5"),
    spell("Luz", "action", null),
    { kind: "basic", group: "action", ref: ref("action:dash|xphb"), name: "Correr", icon: null },
    { kind: "feature", group: "bonus", ref: ref("classFeature:second wind"), name: "Recuperar el aliento", source: "Guerrero", special: false },
    { kind: "basic", group: "reaction", ref: ref("action:opportunity attack|xphb"), name: "Ataque de oportunidad", icon: null },
  ],
};

describe("parseActionFilter", () => {
  it("acepta los filtros conocidos", () => {
    for (const f of ["todo", "ataques", "action", "bonus", "reaction", "other"]) expect(parseActionFilter(f)).toBe(f);
  });
  it("cae en todo con uno desconocido o ausente", () => {
    expect(parseActionFilter("nada")).toBe("todo");
    expect(parseActionFilter(undefined)).toBe("todo");
    expect(parseActionFilter(["bonus"])).toBe("todo");
  });
});

describe("actionFilterHref", () => {
  it("fija la pestaña y el filtro, y conserva el resto salvo la ficha de conjuro", () => {
    expect(actionFilterHref({ tab: "info", filtro: "bonus", spell: "x", foo: "1" }, "reaction"))
      .toBe("?tab=acciones&foo=1&filtro=reaction");
  });
  it("no conserva el aviso de guardado", () => {
    expect(actionFilterHref({ saved: "1", foo: "1" }, "bonus")).toBe("?tab=acciones&foo=1&filtro=bonus");
  });
  it("sin filtro con Todo", () => {
    expect(actionFilterHref({ filtro: "bonus" }, "todo")).toBe("?tab=acciones");
  });
});

describe("actionSections", () => {
  it("con Todo, cada grupo con algo, en orden, y los conjuros con tirada en la tabla", () => {
    const s = actionSections(summary, "todo");
    expect(s.map((x) => x.title)).toEqual(["Acciones", "Acciones adicionales", "Reacciones"]);
    expect(s[0].attacks.map((a) => a.kind)).toEqual(["attack", "spell"]);
    expect(s[0].spells.map((a) => a.name)).toEqual(["Luz"]);
    expect(s[0].basics.map((a) => a.name)).toEqual(["Correr"]);
    expect(s[1].features.map((a) => a.name)).toEqual(["Recuperar el aliento"]);
  });
  it("con Ataques, solo las tablas", () => {
    const s = actionSections(summary, "ataques");
    expect(s).toHaveLength(1);
    expect(s[0].attacks).toHaveLength(2);
    expect(s[0].spells.length + s[0].features.length + s[0].basics.length).toBe(0);
  });
  it("con un grupo, solo su sección; vacía, ninguna", () => {
    expect(actionSections(summary, "reaction").map((x) => x.group)).toEqual(["reaction"]);
    expect(actionSections(summary, "other")).toEqual([]);
  });
});

describe("sectionVisibility", () => {
  const all = actionSections(summary, "todo");
  const vis = (f: Parameters<typeof sectionVisibility>[1]) => all.map((s) => sectionVisibility(s, f));
  it("con Todo, todo a la vista", () => {
    for (const v of vis("todo")) expect(Object.values(v).every(Boolean)).toBe(true);
  });
  it("con Ataques, solo las tablas de las secciones que tienen ataques", () => {
    const v = vis("ataques");
    expect(v[0]).toEqual({ section: true, attacks: true, spells: false, features: false, basics: false });
    expect(v[1].section).toBe(false);
    expect(v[2].section).toBe(false);
  });
  it("con un grupo, solo esa sección entera", () => {
    expect(vis("bonus").map((v) => v.section)).toEqual([false, true, false]);
    expect(vis("bonus")[1]).toEqual({ section: true, attacks: true, spells: true, features: true, basics: true });
  });
});
