import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/rules/catalog";
import { equipmentRefs } from "@/lib/rules/dnd2024/equipmentRefs";

const ref = (key: string) => ({ book: "b", key });
const pack = {
  ref: ref("item:explorer's pack|xphb"), name: "Explorer's Pack", nameEs: null, bookName: "", srd52: true,
  data: { contents: [{ ref: ref("item:backpack|xphb"), quantity: 1 }, { ref: ref("item:torch|xphb"), quantity: 10 }] },
  description: "", descriptionEs: "", identifier: "", parent: null, foundry: null,
} as CatalogEntry;

describe("equipmentRefs", () => {
  const options = [[{ ref: ref("item:greataxe|xphb") }, { ref: pack.ref }, { value: 1500 }], [{ ref: ref("item:greataxe|xphb") }]];

  it("sin paquetes cargados, devuelve las referencias de las opciones sin repetir", () => {
    expect(equipmentRefs(options, () => undefined).map((r) => r.key)).toEqual([
      "item:greataxe|xphb", "item:explorer's pack|xphb",
    ]);
  });
  it("con el paquete cargado, añade su contenido", () => {
    const keys = equipmentRefs(options, (k) => (k === `b:${pack.ref.key}` ? pack : null)).map((r) => r.key);
    expect(keys).toEqual(["item:greataxe|xphb", "item:explorer's pack|xphb", "item:backpack|xphb", "item:torch|xphb"]);
  });
});
