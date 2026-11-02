import { describe, expect, it } from "vitest";
import { normalizeSheetTab, type SheetTabId } from "@/lib/rules/dnd2024/sheet/sheetTabs";

const all: SheetTabId[] = ["acciones", "conjuros", "inventario", "rasgos", "trasfondo", "notas"];

describe("normalizeSheetTab", () => {
  it("conserva una pestaña disponible", () => {
    expect(normalizeSheetTab("rasgos", all)).toBe("rasgos");
  });
  it("traduce los ids antiguos", () => {
    expect(normalizeSheetTab("info", all)).toBe("acciones");
    expect(normalizeSheetTab("equipo", all)).toBe("inventario");
  });
  it("cae en acciones con una pestaña desconocida", () => {
    expect(normalizeSheetTab("nada", all)).toBe("acciones");
    expect(normalizeSheetTab(undefined, all)).toBe("acciones");
  });
  it("cae en acciones con una pestaña no disponible", () => {
    expect(normalizeSheetTab("conjuros", ["acciones", "inventario", "rasgos", "trasfondo"])).toBe("acciones");
  });
  it("conserva notas si está disponible y cae en acciones si no", () => {
    expect(normalizeSheetTab("notas", all)).toBe("notas");
    expect(normalizeSheetTab("notas", ["acciones", "inventario", "rasgos", "trasfondo"])).toBe("acciones");
  });
});
