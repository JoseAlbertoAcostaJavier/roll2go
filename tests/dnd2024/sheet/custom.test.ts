import { describe, expect, it } from "vitest";
import { applyCustom, customOf, ordered } from "@/lib/rules/dnd2024/sheet/custom";
import { xpForNextLevel } from "@/lib/rules/dnd2024/sheet/xp";
import { defensesOf } from "@/lib/rules/dnd2024/derive/defenses";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";

const sheet = (custom?: Dnd2024SheetV2["custom"]) => ({ custom }) as unknown as Dnd2024SheetV2;
let n = 0;
const newId = () => `id${++n}`;
const ok = (r: ReturnType<typeof applyCustom>) => {
  if (!r.ok) throw new Error(r.error);
  return r.custom;
};

describe("customOf", () => {
  it("una hoja antigua se lee como vacía", () => {
    expect(customOf(sheet())).toEqual({ items: [], notes: [], defenses: [], conditions: [], order: {}, hidden: [], basics: { on: [], off: [], edits: [] } });
  });
});

describe("elementos personalizados", () => {
  it("añade un ataque con su id y lo quita", () => {
    const c = ok(applyCustom(sheet(), { op: "addItem", item: { kind: "attack", name: " Mordisco ", range: "1,5 m", hit: "+5", damage: "1d6+3" } }, () => "a1"));
    expect(c.items).toEqual([{ id: "a1", kind: "attack", name: "Mordisco", range: "1,5 m", hit: "+5", damage: "1d6+3", notes: "" }]);
    expect(ok(applyCustom(sheet(c), { op: "removeItem", id: "a1" }, newId)).items).toEqual([]);
  });

  it("exige nombre, un tipo conocido y su grupo", () => {
    expect(applyCustom(sheet(), { op: "addItem", item: { kind: "attack", name: "  " } }, newId).ok).toBe(false);
    expect(applyCustom(sheet(), { op: "addItem", item: { kind: "otro", name: "X" } }, newId).ok).toBe(false);
    expect(applyCustom(sheet(), { op: "addItem", item: { kind: "action", name: "X", group: "nada" } }, newId).ok).toBe(false);
    expect(applyCustom(sheet(), { op: "addItem", item: { kind: "feature", name: "X", section: "nada" } }, newId).ok).toBe(false);
  });

  it("rechaza textos demasiado largos", () => {
    expect(applyCustom(sheet(), { op: "addItem", item: { kind: "attack", name: "x".repeat(81) } }, newId).ok).toBe(false);
  });
});

describe("categorías de notas", () => {
  it("añade, edita y quita", () => {
    const a = ok(applyCustom(sheet(), { op: "addNote", title: "Deudas" }, () => "n1"));
    expect(a.notes).toEqual([{ id: "n1", title: "Deudas", text: "" }]);
    const b = ok(applyCustom(sheet(a), { op: "updateNote", id: "n1", text: "Debo 5 po\n" }, newId));
    expect(b.notes[0].text).toBe("Debo 5 po\n");
    expect(ok(applyCustom(sheet(b), { op: "removeNote", id: "n1" }, newId)).notes).toEqual([]);
  });

  it("no acepta un título vacío ni una categoría que no existe", () => {
    expect(applyCustom(sheet(), { op: "addNote", title: "" }, newId).ok).toBe(false);
    expect(applyCustom(sheet(), { op: "updateNote", id: "x", text: "a" }, newId).ok).toBe(false);
  });
});

describe("defensas a mano", () => {
  it("activa y desactiva sin repetir", () => {
    const a = ok(applyCustom(sheet(), { op: "defense", kind: "resist", type: "fire", active: true }, newId));
    const b = ok(applyCustom(sheet(a), { op: "defense", kind: "resist", type: "fire", active: true }, newId));
    expect(b.defenses).toEqual([{ kind: "resist", type: "fire" }]);
    expect(ok(applyCustom(sheet(b), { op: "defense", kind: "resist", type: "fire", active: false }, newId)).defenses).toEqual([]);
  });

  it("solo tipos de cada grupo: daño en las resistencias y estados en sus inmunidades", () => {
    expect(applyCustom(sheet(), { op: "defense", kind: "resist", type: "blinded", active: true }, newId).ok).toBe(false);
    expect(applyCustom(sheet(), { op: "defense", kind: "conditionImmune", type: "blinded", active: true }, newId).ok).toBe(true);
    expect(applyCustom(sheet(), { op: "defense", kind: "conditionImmune", type: "fire", active: true }, newId).ok).toBe(false);
  });

  it("se suman a las calculadas como una fuente más", () => {
    const rows = defensesOf([
      { name: "Tiefling", defenses: { resist: ["fire"] } },
      { name: "Añadida a mano", defenses: { resist: ["fire", "cold"] } },
    ]);
    expect(rows).toEqual([
      { kind: "resist", type: "fire", sources: ["Tiefling", "Añadida a mano"] },
      { kind: "resist", type: "cold", sources: ["Añadida a mano"] },
    ]);
  });
});

describe("orden y ocultos", () => {
  it("guarda el orden de la sección y oculta o muestra", () => {
    const a = ok(applyCustom(sheet(), { op: "order", section: "ataques", keys: ["b", "a"] }, newId));
    expect(a.order).toEqual({ ataques: ["b", "a"] });
    const b = ok(applyCustom(sheet(a), { op: "hide", key: "a", hidden: true }, newId));
    expect(b.hidden).toEqual(["a"]);
    expect(ok(applyCustom(sheet(b), { op: "hide", key: "a", hidden: false }, newId)).hidden).toEqual([]);
  });

  it("rechaza listas que no son de texto", () => {
    expect(applyCustom(sheet(), { op: "order", section: "x", keys: [1] }, newId).ok).toBe(false);
  });

  it("ordered: las filas sin posición guardada van al final, en su orden", () => {
    const rows = ["a", "b", "c", "d"].map((key) => ({ key }));
    expect(ordered(rows, ["c", "a"]).map((r) => r.key)).toEqual(["c", "a", "b", "d"]);
    expect(ordered(rows, undefined).map((r) => r.key)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("xpForNextLevel", () => {
  it("la experiencia del nivel siguiente; ninguna en el máximo", () => {
    expect(xpForNextLevel(1)).toBe(300);
    expect(xpForNextLevel(10)).toBe(85000);
    expect(xpForNextLevel(19)).toBe(355000);
    expect(xpForNextLevel(20)).toBeNull();
    expect(xpForNextLevel(0)).toBeNull();
  });
});
