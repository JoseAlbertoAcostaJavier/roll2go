// Ediciones rápidas de la ficha (PG e inventario). Funciones puras: validan la entrada del cliente y devuelven la hoja
// nueva; las rutas las aplican tras comprobar el acceso. Sin Next ni mongoose.
import { cleanText } from "@/lib/utils/utils";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { ItemData, Ref } from "@/lib/rules/types";
import type { Coins, Dnd2024SheetV2, Inventory, InventoryItem } from "./sheet";

export type EditResult = { ok: true; sheet: Dnd2024SheetV2 } | { ok: false; error: string };

export const MAX_TEMP_HP = 9999;
export const MAX_QUANTITY = 9999;
export const MAX_COINS = 9_999_999;
export const MAX_ITEM_NAME = 80;
export const MAX_ITEM_NOTES = 500;
export const MAX_OTHER = 5000;
export const MAX_ITEMS = 300;
const COIN_KEYS: (keyof Coins)[] = ["cp", "sp", "ep", "gp", "pp"];

export type InventoryOp =
  | { op: "add"; ref?: Ref; name?: string; quantity?: number; notes?: string }
  | { op: "update"; id: string; quantity?: number; notes?: string; equipped?: boolean }
  | { op: "remove"; id: string }
  | { op: "coins"; coins: Coins }
  | { op: "other"; text: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** PG actuales (0..máximo calculado) y temporales (0–9999). Lo que no llega se conserva. */
export function applyHp(sheet: Dnd2024SheetV2, input: unknown, maxHp: number): EditResult {
  if (!isObj(input)) return fail("Petición no válida.");
  const hp = { ...sheet.hp };
  if (input.current !== undefined) {
    if (!isInt(input.current) || input.current < 0 || input.current > maxHp)
      return fail(`Los PG actuales van de 0 a ${maxHp}.`);
    hp.current = input.current;
  }
  if (input.temp !== undefined) {
    if (!isInt(input.temp) || input.temp < 0 || input.temp > MAX_TEMP_HP)
      return fail(`Los PG temporales van de 0 a ${MAX_TEMP_HP}.`);
    hp.temp = input.temp;
  }
  return { ok: true, sheet: { ...sheet, hp } };
}

const itemData = (e: CatalogEntry | null) => e?.data as ItemData | undefined;
const isShield = (d: ItemData | undefined) => d?.armor?.category === "shield";
const isBodyArmor = (d: ItemData | undefined) => !!d?.armor && !isShield(d);
const canEquip = (d: ItemData | undefined) => !!d && (!!d.weapon || !!d.armor || !!d.defenses);

const QUANTITY_ERROR = `La cantidad va de 0 a ${MAX_QUANTITY}.`;
const NOTES_ERROR = `Las notas admiten ${MAX_ITEM_NOTES} caracteres como máximo.`;
const cleanNotes = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const notes = cleanText(v);
  return notes.length <= MAX_ITEM_NOTES ? notes : null;
};

export function applyInventoryOp(
  sheet: Dnd2024SheetV2,
  op: unknown,
  resolveItem: (ref: Ref) => CatalogEntry | null,
  makeId: () => string,
): EditResult {
  if (!isObj(op) || typeof op.op !== "string") return fail("Petición no válida.");
  const inv = sheet.inventory;
  const save = (inventory: Inventory): EditResult => ({ ok: true, sheet: { ...sheet, inventory } });
  const unavailable = () => fail("Ese objeto no está disponible para este personaje.");

  // Al equipar una armadura o un escudo se desequipa el anterior de su mismo tipo
  const unequipSameKind = (items: InventoryItem[], line: InventoryItem, data: ItemData | undefined) => {
    const kind = isShield(data) ? isShield : isBodyArmor(data) ? isBodyArmor : null;
    if (!kind) return items;
    return items.map((i) =>
      i.id !== line.id && i.equipped && i.ref && kind(itemData(resolveItem(i.ref))) ? { ...i, equipped: false } : i,
    );
  };

  switch (op.op) {
    case "add": {
      if (inv.items.length >= MAX_ITEMS) return fail(`El inventario admite ${MAX_ITEMS} líneas como máximo.`);
      const quantity = op.quantity === undefined ? 1 : op.quantity;
      if (!isInt(quantity) || quantity < 0 || quantity > MAX_QUANTITY) return fail(QUANTITY_ERROR);
      const notes = op.notes === undefined ? "" : cleanNotes(op.notes);
      if (notes === null) return fail(NOTES_ERROR);
      let ref: Ref | null = null;
      let name: string;
      if (op.ref !== undefined && op.ref !== null) {
        if (!isObj(op.ref) || typeof op.ref.book !== "string" || typeof op.ref.key !== "string") return unavailable();
        const entry = resolveItem({ book: op.ref.book, key: op.ref.key });
        if (!entry) return unavailable();
        ref = { book: entry.ref.book, key: entry.ref.key };
        name = (entry.nameEs ?? entry.name).slice(0, MAX_ITEM_NAME);
      } else {
        name = typeof op.name === "string" ? cleanText(op.name).trim() : "";
        if (!name) return fail("Escribe un nombre.");
        if (name.length > MAX_ITEM_NAME) return fail(`El nombre admite ${MAX_ITEM_NAME} caracteres como máximo.`);
      }
      const line: InventoryItem = { id: makeId(), ref, name, quantity, equipped: false, notes };
      return save({ ...inv, items: [...inv.items, line] });
    }
    case "update": {
      const line = typeof op.id === "string" ? inv.items.find((i) => i.id === op.id) : undefined;
      if (!line) return fail("Ese objeto no está en el inventario.");
      const next = { ...line };
      if (op.quantity !== undefined) {
        if (!isInt(op.quantity) || op.quantity < 0 || op.quantity > MAX_QUANTITY) return fail(QUANTITY_ERROR);
        next.quantity = op.quantity;
      }
      if (op.notes !== undefined) {
        const notes = cleanNotes(op.notes);
        if (notes === null) return fail(NOTES_ERROR);
        next.notes = notes;
      }
      let items = inv.items;
      if (op.equipped !== undefined) {
        if (typeof op.equipped !== "boolean") return fail("Petición no válida.");
        if (op.equipped) {
          const data = itemData(line.ref ? resolveItem(line.ref) : null);
          if (!canEquip(data)) return fail("Solo se pueden equipar armaduras, escudos, armas y objetos con resistencias o inmunidades.");
          items = unequipSameKind(items, line, data);
        }
        next.equipped = op.equipped;
      }
      return save({ ...inv, items: items.map((i) => (i.id === line.id ? next : i)) });
    }
    case "remove": {
      if (typeof op.id !== "string" || !inv.items.some((i) => i.id === op.id))
        return fail("Ese objeto no está en el inventario.");
      return save({ ...inv, items: inv.items.filter((i) => i.id !== op.id) });
    }
    case "coins": {
      if (!isObj(op.coins)) return fail("Petición no válida.");
      const coins = {} as Coins;
      for (const k of COIN_KEYS) {
        const v = op.coins[k];
        if (!isInt(v) || v < 0 || v > MAX_COINS) return fail(`Las monedas van de 0 a ${MAX_COINS.toLocaleString("es-ES")}.`);
        coins[k] = v;
      }
      return save({ ...inv, coins });
    }
    case "other": {
      if (typeof op.text !== "string") return fail("Petición no válida.");
      const other = cleanText(op.text);
      if (other.length > MAX_OTHER) return fail(`Las otras posesiones admiten ${MAX_OTHER} caracteres como máximo.`);
      return save({ ...inv, other });
    }
    default:
      return fail("Operación no válida.");
  }
}
