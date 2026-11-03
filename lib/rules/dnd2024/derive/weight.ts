// Peso del inventario y capacidad de carga (spec §4.1). Pesos en libras.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { inventoryWeights, type WeightInfo } from "@/lib/rules/dnd2024/sheet/inventory";
import type { Inventory } from "@/lib/rules/dnd2024/sheet/sheet";
import type { ItemData } from "@/lib/rules/types";

const CAPACITY_PER_STR = 15;
// Las criaturas Grandes cargan el doble
const SIZE_MULTIPLIER: Record<string, number> = { L: 2 };

export function carriedWeight(inventory: Inventory, entries: Map<string, CatalogEntry>, strScore: number, size: string | null): {
  total: number; capacity: number; over: boolean;
} {
  const info: Record<string, WeightInfo> = {};
  for (const i of inventory.items) {
    const data = i.ref ? (entries.get(refKey(i.ref))?.data as ItemData | undefined) : undefined;
    info[i.id] = { weight: data?.weight ?? 0, container: data?.container ? { weightless: data.container.weightless } : null };
  }
  const total = inventoryWeights(inventory.items, info).carried;
  const capacity = strScore * CAPACITY_PER_STR * (SIZE_MULTIPLIER[size ?? ""] ?? 1);
  return { total, capacity, over: total > capacity };
}
