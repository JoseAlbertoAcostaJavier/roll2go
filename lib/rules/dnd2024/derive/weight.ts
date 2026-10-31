// Peso del inventario y capacidad de carga (spec §4.1). Pesos en libras.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { Inventory } from "@/lib/rules/dnd2024/sheet/sheet";
import type { ItemData } from "@/lib/rules/types";

const CAPACITY_PER_STR = 15;
// Las criaturas Grandes cargan el doble
const SIZE_MULTIPLIER: Record<string, number> = { L: 2 };

export function carriedWeight(inventory: Inventory, entries: Map<string, CatalogEntry>, strScore: number, size: string | null): {
  total: number; capacity: number; over: boolean;
} {
  let total = 0;
  for (const i of inventory.items) {
    const weight = i.ref ? ((entries.get(refKey(i.ref))?.data as ItemData | undefined)?.weight ?? 0) : 0;
    total += weight * i.quantity;
  }
  total = Math.round(total * 100) / 100;
  const capacity = strScore * CAPACITY_PER_STR * (SIZE_MULTIPLIER[size ?? ""] ?? 1);
  return { total, capacity, over: total > capacity };
}
