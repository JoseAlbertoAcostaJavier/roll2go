import { describe, expect, it } from "vitest";
import { parseBbcode, plainText } from "@/lib/utils/bbcode";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { itemActions } from "@/lib/rules/dnd2024/sheet/itemActions";
import type { InventoryItem } from "@/lib/rules/dnd2024/sheet/sheet";
import names from "@/lib/rules/i18n/es.json";
import descriptions from "@/lib/rules/i18n/es-descriptions.json";

const entries = Object.entries(descriptions as Record<string, string>);

describe("descripciones oficiales del SRD en español", () => {
  it("cada texto corresponde a una entrada con nombre en español y cabe en el campo", () => {
    expect(entries.length).toBeGreaterThanOrEqual(339);
    for (const [key, text] of entries) {
      expect((names as Record<string, string>)[key], key).toBeTruthy();
      expect(text.length, key).toBeGreaterThan(20);
      expect(text.length, key).toBeLessThanOrEqual(50000);
    }
  });

  it("no quedan restos de la maquetación del PDF", () => {
    for (const [key, text] of entries) {
      expect(text, key).not.toMatch(/[­‑ ]/);
      expect(text, key).not.toMatch(/Documento de referencia del sistema/);
      expect(text, key).not.toMatch(/(^|[ (])[bcdfgjnprstvz] [a-záéíóúñ]{3,}/);
      expect(text, key).not.toMatch(/[a-záéíóúñ]- [a-záéíóúñ]/);
    }
  });

  it("la ficha sigue leyendo la curación de los objetos en español", () => {
    const healingOf = (key: string, description: string) => {
      const entry = { descriptionEs: (descriptions as Record<string, string>)[key], description, data: { type: "P" } } as unknown as CatalogEntry;
      const ref = { book: "b", key };
      const line = { id: "1", name: "Objeto", quantity: 1, ref } as unknown as InventoryItem;
      return itemActions([line], new Map([[refKey(ref), entry]]))[0]?.healing;
    };
    expect(healingOf("item:potion of healing|xdmg", "")).toBe("2d4+2");
    expect(healingOf("item:potion of greater healing|xdmg", "")).toBe("4d4+4");
    expect(healingOf("item:potion of superior healing|xdmg", "")).toBe("8d4+8");
    expect(healingOf("item:potion of supreme healing|xdmg", "")).toBe("10d4+20");
    expect(healingOf("item:periapt of health|xdmg", "")).toBe("2d4+2");
  });

  it("el BBCode es válido: no se muestra ninguna etiqueta como texto", () => {
    for (const [key, text] of entries) {
      expect(plainText(parseBbcode(text)), key).not.toMatch(/\[\/?(b|i|list|\*)\]/);
    }
  });
});
