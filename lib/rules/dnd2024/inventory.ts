// Inventario inicial: vuelca el equipo elegido de clase y trasfondo en líneas de inventario. Función pura; el id de
// cada línea lo da quien llama (`makeId`, un ObjectId en texto en el servidor).
import type { CatalogEntry } from "@/lib/rules/catalog";
import type { ItemData, Pack } from "@/lib/rules/types";
import { bareName, refKey } from "./equipmentRefs";
import type { Inventory, InventoryItem } from "./sheet";


export function startingInventory(
  choices: { pack: Pack[] }[],
  entries: Map<string, CatalogEntry>,
  makeId: () => string,
): Inventory {
  const items: InventoryItem[] = [];
  const byKey = new Map<string, InventoryItem>();
  let copper = 0;

  // Despliega los paquetes (`contents`) y suma las cantidades de un mismo objeto
  const add = (packs: Pack[], multiplier: number) => {
    for (const p of packs) {
      if (p.value) copper += p.value * multiplier;
      if (!p.ref && !p.displayName) continue;
      const quantity = (p.quantity ?? 1) * multiplier;
      const entry = p.ref ? entries.get(refKey(p.ref)) : undefined;
      const contents = (entry?.data as ItemData | undefined)?.contents;
      if (contents) {
        add(contents.map((c) => ({ ref: c.ref, quantity: c.quantity })), quantity);
        continue;
      }
      const key = p.ref ? refKey(p.ref) : `texto:${p.displayName}`;
      const line = byKey.get(key);
      if (line) {
        line.quantity += quantity;
        continue;
      }
      const item: InventoryItem = {
        id: makeId(),
        ref: p.ref ? { book: p.ref.book, key: p.ref.key } : null,
        name: entry ? (entry.nameEs ?? entry.name) : (p.displayName ?? bareName(p.ref!.key)),
        quantity,
        equipped: false,
        notes: "",
      };
      byKey.set(key, item);
      items.push(item);
    }
  };
  for (const c of choices) add(c.pack, 1);

  // Se equipan la armadura de mayor CA base, el primer escudo y todas las armas
  const dataOf = (i: InventoryItem) => (i.ref ? (entries.get(refKey(i.ref))?.data as ItemData | undefined) : undefined);
  let bestArmor: InventoryItem | null = null;
  let bestAc = -1;
  let shield = false;
  for (const i of items) {
    const data = dataOf(i);
    if (data?.weapon) i.equipped = true;
    else if (data?.armor?.category === "shield") {
      if (!shield) i.equipped = shield = true;
    } else if (data?.armor && data.armor.ac > bestAc) {
      bestArmor = i;
      bestAc = data.armor.ac;
    }
  }
  if (bestArmor) bestArmor.equipped = true;

  return {
    items,
    coins: { cp: copper % 10, sp: Math.floor((copper % 100) / 10), ep: 0, gp: Math.floor(copper / 100), pp: 0 },
    other: "",
  };
}
