// Búsqueda, chips de filtro y secciones de la pestaña Inventario. Módulo puro.
import { effectiveContainer, inventoryWeights, type WeightInfo } from "./inventory";
import { itemTypeName, rarityName, weaponPropertyName } from "./labels";
import type { InventoryItem } from "./sheet";

/** Capacidad de un contenedor: `text` es la que no va en peso («12 pies cúbicos», «20 × Virote»). */
export type ContainerInfo = { weight: number | null; text: string | null; weightless: boolean };

/** Datos del catálogo de cada línea (clave: id de la línea). Pesos en libras, `value` en pc; `type` y `properties` son códigos de 5etools. */
export type ItemInfo = WeightInfo & {
  equippable: boolean;
  nameEn: string | null;
  type: string | null;
  rarity: string | null;
  /** Requiere sintonización. */
  attunement?: boolean;
  properties: string[];
  value: number;
  container: ContainerInfo | null;
};

/** Minúsculas y sin tildes. */
export const searchText = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Si la línea casa con la búsqueda `q` (nombre, nombre en inglés, tipo, rareza y propiedades). `q` vacío casa con todo. */
export function matchesItem(line: InventoryItem, info: ItemInfo | undefined, q: string): boolean {
  const needle = searchText(q).trim();
  if (!needle) return true;
  const parts = [line.name];
  if (info) {
    if (info.nameEn) parts.push(info.nameEn);
    if (info.type) parts.push(itemTypeName(info.type));
    if (info.rarity) parts.push(rarityName(info.rarity));
    parts.push(...info.properties.map(weaponPropertyName));
  }
  return searchText(parts.join(" ")).includes(needle);
}

type Info = Record<string, ItemInfo | undefined>;

/** Líneas de la sección Sintonización: las que la requieren y las ya sintonizadas, para poder deshacerlo. */
export const attunementLines = (items: InventoryItem[], info: Info): InventoryItem[] =>
  items.filter((l) => info[l.id]?.attunement || l.attuned);

/** Chips de filtro, en orden: Todo, Equipado, un chip por línea contenedora y Otras posesiones. */
export function inventoryChips(items: InventoryItem[], info: Info): { id: string; label: string }[] {
  return [
    { id: "todo", label: "Todo" },
    { id: "equipado", label: "Equipado" },
    ...items.filter((i) => info[i.id]?.container).map((i) => ({ id: i.id, label: i.name })),
    { id: "otras", label: "Otras posesiones" },
  ];
}

export type InventoryGroup = {
  id: string;
  title: string;
  lines: InventoryItem[];
  container: { line: InventoryItem; weight: number; capacity: ContainerInfo; over: boolean } | null;
};

/**
 * Grupos de la sección activa: «Equipo» (lo suelto) y uno por contenedor. Con `q`, solo las líneas que casan y sin
 * grupos vacíos.
 */
export function inventoryGroups(items: InventoryItem[], info: Info, section: string, q: string): InventoryGroup[] {
  const { byContainer } = inventoryWeights(items, info);
  const loose = (i: InventoryItem) => effectiveContainer(i, items, info) === null;
  const equipo = (lines: InventoryItem[]): InventoryGroup => ({ id: "equipo", title: "Equipo", lines, container: null });
  const containers = (): InventoryGroup[] =>
    items.flatMap((line) => {
      const capacity = info[line.id]?.container;
      if (!capacity) return [];
      const weight = byContainer[line.id] ?? 0;
      return [{
        id: line.id,
        title: line.name,
        lines: items.filter((i) => effectiveContainer(i, items, info) === line.id),
        container: { line, weight, capacity, over: capacity.weight !== null && weight > capacity.weight },
      }];
    });

  let groups: InventoryGroup[];
  if (section === "otras") return [];
  if (section === "equipado") groups = [equipo(items.filter((i) => i.equipped))];
  else if (section === "todo") groups = [equipo(items.filter(loose)), ...containers()];
  else groups = containers().filter((g) => g.id === section);

  if (!searchText(q).trim()) return groups;
  return groups
    .map((g) => ({ ...g, lines: g.lines.filter((l) => matchesItem(l, info[l.id], q)) }))
    .filter((g) => g.lines.length > 0);
}

type Query = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Dirección con la búsqueda cambiada por `patch.q` (o la actual): `tab` primero, el resto menos `spell` y `saved`, y sin `q` si queda vacío. */
export function inventoryHref(query: Query, patch: { q?: string }): string {
  const q = (patch.q ?? first(query.q) ?? "").trim();
  const params = new URLSearchParams();
  const tab = first(query.tab);
  if (tab) params.set("tab", tab);
  for (const [k, v] of Object.entries(query)) {
    if (k === "tab" || k === "q" || k === "spell" || k === "saved" || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) params.append(k, x);
  }
  if (q) params.set("q", q);
  const s = params.toString();
  return s ? `?${s}` : "?";
}
