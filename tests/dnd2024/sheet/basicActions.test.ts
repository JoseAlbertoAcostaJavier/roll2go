import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { isEditableAction, shownActions } from "@/lib/rules/dnd2024/sheet/basicActions";
import { applyCustom, customOf } from "@/lib/rules/dnd2024/sheet/custom";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";

const entry = (book: string, name: string, descriptionEs = ""): CatalogEntry =>
  ({ ref: { book, key: `action:${name}` }, name, nameEs: null, description: "Text", descriptionEs, data: { time: "action" } }) as unknown as CatalogEntry;
const attack = entry("core", "attack", "Atacas");
const improvise = entry("core", "improvise");
const disarm = entry("dmg", "disarm");
const all = [attack, improvise, disarm];
const open = { coreBooks: ["core"], restricted: false };
const none = { on: [], off: [], edits: [] };
const names = (l: CatalogEntry[]) => l.map((e) => e.nameEs ?? e.name);

describe("shownActions", () => {
  it("por defecto, solo las de las reglas básicas", () => {
    expect(names(shownActions(all, none, open))).toEqual(["attack", "improvise"]);
  });
  it("se pueden activar otras y desactivar las básicas", () => {
    expect(names(shownActions(all, { ...none, on: ["dmg:action:disarm"] }, open))).toEqual(["attack", "improvise", "disarm"]);
    expect(names(shownActions(all, { ...none, off: ["core:action:attack"] }, open))).toEqual(["improvise"]);
  });
  it("una campaña con libros restringidos muestra todo lo permitido, sin elecciones", () => {
    expect(names(shownActions(all, { ...none, off: ["core:action:attack"] }, { coreBooks: ["core"], restricted: true }))).toEqual(["attack", "improvise", "disarm"]);
  });
  it("aplica el nombre y texto propios solo si no hay texto oficial", () => {
    const edits = [{ key: "core:action:improvise", name: "Improvisar", details: "Algo" }, { key: "core:action:attack", name: "Pegar", details: "No" }];
    const out = shownActions(all, { ...none, edits }, open);
    expect(names(out)).toEqual(["attack", "Improvisar"]);
    expect(out[1].descriptionEs).toBe("Algo");
  });
  it("son editables las que no tienen texto oficial en español", () => {
    expect(isEditableAction(attack)).toBe(false);
    expect(isEditableAction(disarm)).toBe(true);
  });
});

describe("operaciones sobre las acciones básicas", () => {
  const sheet = { custom: undefined } as unknown as Dnd2024SheetV2;
  const apply = (s: Dnd2024SheetV2, op: object) => {
    const r = applyCustom(s, op, () => "x");
    if (!r.ok) throw new Error(r.error);
    return r.sheet;
  };
  it("guarda las básicas al apagarlas y las demás al encenderlas", () => {
    const a = apply(sheet, { op: "basicActive", key: "k", active: false, core: true });
    expect(customOf(a).basics.off).toEqual(["k"]);
    expect(customOf(apply(a, { op: "basicActive", key: "k", active: true, core: true })).basics.off).toEqual([]);
    expect(customOf(apply(sheet, { op: "basicActive", key: "d", active: true, core: false })).basics.on).toEqual(["d"]);
  });
  it("edita, sustituye y restablece", () => {
    const a = apply(sheet, { op: "basicEdit", key: "k", name: " Uno ", details: "Texto" });
    expect(customOf(a).basics.edits).toEqual([{ key: "k", name: "Uno", details: "Texto" }]);
    const b = apply(a, { op: "basicEdit", key: "k", name: "Dos", details: "" });
    expect(customOf(b).basics.edits).toEqual([{ key: "k", name: "Dos", details: "" }]);
    expect(customOf(apply(b, { op: "basicEditClear", key: "k" })).basics.edits).toEqual([]);
  });
  it("rechaza nombres vacíos o peticiones mal formadas", () => {
    expect(applyCustom(sheet, { op: "basicEdit", key: "k", name: "  " }, () => "x").ok).toBe(false);
    expect(applyCustom(sheet, { op: "basicActive", key: "k", active: "sí", core: true }, () => "x").ok).toBe(false);
  });
});
