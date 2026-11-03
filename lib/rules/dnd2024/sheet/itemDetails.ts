// Filas de la ficha de detalle de un objeto del inventario. Módulo puro.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { ItemData } from "@/lib/rules/types";
import type { InventoryItem } from "./sheet";
import { damageTypeName, itemTypeName, masteryName, rarityName, weaponPropertyName } from "./labels";

export type ItemDetails = { name: string; subtitle: string | null; rows: { label: string; value: string }[] };

const LB_TO_KG = 0.4536;
const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });
const weightText = (lb: number) => `${fmt(lb)} lb (${fmt(lb * LB_TO_KG)} kg)`;

/** Datos para la ficha de un objeto; sin entrada del catálogo (objeto propio) solo lleva cantidad y notas. */
export function itemDetails(line: InventoryItem, entry: CatalogEntry | undefined, capacityText: string | null): ItemDetails {
  const rows: ItemDetails["rows"] = [];
  const add = (label: string, value: string) => rows.push({ label, value });
  const data = entry?.data as ItemData | undefined;

  if (data) {
    if (data.weight > 0) add("Peso", weightText(data.weight));
    if (data.value > 0) add("Coste", `${fmt(data.value / 100)} po`);
    const w = data.weapon;
    if (w) {
      add("Daño", `${w.damage} ${damageTypeName(w.damageType)}`);
      if (w.properties.length) add("Propiedades", w.properties.map(weaponPropertyName).join(", "));
      if (w.mastery) add("Maestría", masteryName(w.mastery));
      if (w.range) add("Alcance", `${w.range} pies`);
    }
    const a = data.armor;
    if (a) {
      add("CA", a.category === "shield" ? `+${a.ac}` : String(a.ac));
      if (a.stealthDisadvantage) add("Sigilo", "Desventaja");
    }
    const capacity = capacityText ?? (data.container?.weight ? `${fmt(data.container.weight)} lb` : null);
    if (capacity) add("Capacidad", capacity);
  }

  add("Cantidad", String(line.quantity));
  if (line.notes.trim()) add("Notas", line.notes);

  const subtitle = data ? [itemTypeName(data.type), data.rarity ? rarityName(data.rarity) : null].filter(Boolean).join(" · ") : null;
  return { name: line.name, subtitle, rows };
}
