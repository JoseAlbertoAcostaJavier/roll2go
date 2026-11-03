// Inventario inicial: vuelca el equipo elegido de clase y trasfondo en líneas de inventario. Función pura; el id de
// cada línea lo da quien llama (`makeId`, un ObjectId en texto en el servidor).
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { ItemData, Pack } from "@/lib/rules/types";
import { bareName, refKey } from "./equipmentRefs";
import type { Inventory, InventoryItem } from "./sheet";

// Tipos de 5etools que no van a la mochila inicial: munición, armas, armaduras, escudos, herramientas, juegos e
// instrumentos (las armas y armaduras sin estos tipos se reconocen por sus datos)
const LOOSE_TYPES = new Set(["A", "AF", "M", "R", "LA", "MA", "HA", "S", "AT", "T", "GS", "INS"]);
// 5etools no marca la ropa: se reconoce por el objeto
const CLOTHING = new Set(["robe", "traveler's clothes", "fine clothes", "costume"]);


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

  // Lo que no se lleva a mano ni puesto va a la primera mochila: quedan sueltos las armas, armaduras, escudos,
  // munición, herramientas, ropa y contenedores
  const backpack = items.find((i) => i.ref && bareName(i.ref.key) === "backpack" && dataOf(i)?.container);
  if (backpack) {
    for (const i of items) {
      const data = dataOf(i);
      const loose = !!data && (!!data.weapon || !!data.armor || !!data.container || LOOSE_TYPES.has(data.type)
        || CLOTHING.has(bareName(i.ref!.key)));
      if (i !== backpack && !loose) i.container = backpack.id;
    }
  }

  return {
    items,
    coins: { cp: copper % 10, sp: Math.floor((copper % 100) / 10), ep: 0, gp: Math.floor(copper / 100), pp: 0 },
    other: "",
  };
}

/** Peso de una línea (por unidad) y, si es un contenedor, si su contenido no pesa. `null` = no es un contenedor. */
export type WeightInfo = { weight: number; container: { weightless: boolean } | null };

/** Id del contenedor donde está la línea, solo si esa línea existe y es un contenedor; si no, `null` (suelta). */
export function effectiveContainer(
  line: InventoryItem,
  items: InventoryItem[],
  info: Record<string, WeightInfo | undefined>,
): string | null {
  const id = line.container;
  if (!id || id === line.id) return null;
  return items.some((i) => i.id === id) && info[id]?.container ? id : null;
}

/**
 * Peso cargado y peso del contenido de cada contenedor (`info` por id de línea). Lo suelto y el propio contenedor
 * cuentan; el contenido solo si el contenedor no es `weightless`.
 */
export function inventoryWeights(
  items: InventoryItem[],
  info: Record<string, WeightInfo | undefined>,
): { carried: number; byContainer: Record<string, number> } {
  const byContainer: Record<string, number> = {};
  for (const i of items) if (info[i.id]?.container) byContainer[i.id] = 0;
  let carried = 0;
  for (const i of items) {
    const w = (info[i.id]?.weight ?? 0) * i.quantity;
    const c = effectiveContainer(i, items, info);
    if (c === null) carried += w;
    else {
      byContainer[c] += w;
      if (!info[c]!.container!.weightless) carried += w;
    }
  }
  for (const id of Object.keys(byContainer)) byContainer[id] = Math.round(byContainer[id] * 100) / 100;
  return { carried: Math.round(carried * 100) / 100, byContainer };
}
