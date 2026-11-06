// Filas de la ficha de detalle de un objeto del inventario. Módulo puro.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { ItemData } from "@/lib/rules/types";
import { attackRange, type Attack } from "../derive/attacks";
import { effectiveContainer, type WeightInfo } from "./inventory";
import type { InventoryItem } from "./sheet";
import {
  damageTypeId, damageTypeName, itemTypeName, MASTERY_TEXTS, masteryName, rarityName, weaponPropertyName,
} from "./labels";

/** `icon` (solo en «Tipo de daño»): clave inglesa del tipo de daño para su icono. */
export type ItemRow = { label: string; value: string; icon?: string };
export type ItemDetails = {
  name: string;
  /** «Arma, común» / «Poción, raro»; sin entrada del catálogo, `null`. */
  subtitle: string | null;
  /** «En Equipo» / «En {contenedor}». */
  location: string;
  /** Qué icono lleva la cabecera. */
  icon: "weapon" | "item";
  rows: ItemRow[];
  /** Maestría con esta arma, si el personaje la tiene. */
  mastery: { name: string; text: string } | null;
};

export type ItemContext = {
  capacityText: string | null;
  /** «En Equipo» / «En {contenedor}» (ver `locationText`). */
  location: string;
  /** Ataque del personaje con esta arma (solo si está equipada). */
  attack?: Attack;
  proficient?: boolean;
  /** El personaje tiene maestría con esta arma. */
  hasMastery?: boolean;
  bookName?: string;
};

const LB_TO_KG = 0.4536;
const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });
const weightText = (lb: number) => `${fmt(lb)} lb (${fmt(lb * LB_TO_KG)} kg)`;
const RANGED_TYPE = "R";
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** «Equipo» si la línea va suelta; si no, el nombre del contenedor. */
export function locationText(
  line: InventoryItem, items: InventoryItem[], info: Record<string, WeightInfo | undefined>,
): string {
  const id = effectiveContainer(line, items, info);
  const name = id ? items.find((i) => i.id === id)?.name : null;
  return `En ${name ?? "Equipo"}`;
}

/** Datos para la ficha de un objeto; sin entrada del catálogo (objeto propio) solo lleva cantidad y notas. */
export function itemDetails(line: InventoryItem, entry: CatalogEntry | undefined, ctx: ItemContext): ItemDetails {
  const rows: ItemRow[] = [];
  const add = (label: string, value: string, icon?: string) => rows.push(icon ? { label, value, icon } : { label, value });
  const data = entry?.data as ItemData | undefined;
  const w = data?.weapon;
  let mastery: ItemDetails["mastery"] = null;

  if (data) {
    if (w) {
      const ranged = data.type === RANGED_TYPE;
      add("Competente", ctx.proficient ? "Sí" : "No");
      add("Tipo de ataque", ranged ? "A distancia" : "Cuerpo a cuerpo");
      add("Alcance", ctx.attack?.range ?? attackRange(data, ranged));
      const damage = ctx.attack?.damage ?? w.damage;
      if (damage) add("Daño", damage);
      if (damage) add("Tipo de daño", capitalize(ctx.attack?.damageType ?? damageTypeName(w.damageType)), damageTypeId(w.damageType));
      if (ctx.hasMastery && w.mastery) {
        mastery = { name: masteryName(w.mastery), text: MASTERY_TEXTS[w.mastery.toLowerCase()] ?? "" };
      }
    }
    if (data.weight > 0) add("Peso", weightText(data.weight));
    if (data.value > 0) add("Coste", `${fmt(data.value / 100)} po`);
    if (w?.properties.length) add("Propiedades", w.properties.map(weaponPropertyName).join(", "));
    const a = data.armor;
    if (a) {
      add("CA", a.category === "shield" ? `+${a.ac}` : String(a.ac));
      if (a.stealthDisadvantage) add("Sigilo", "Desventaja");
    }
    const capacity = ctx.capacityText ?? (data.container?.weight ? `${fmt(data.container.weight)} lb` : null);
    if (capacity) add("Capacidad", capacity);
    if (data.container?.weightless) add("Peso del contenido", "No cuenta para el peso cargado");
    if (ctx.bookName) add("Fuente", ctx.bookName);
  }

  add("Cantidad", String(line.quantity));
  if (line.notes.trim()) add("Notas", line.notes);

  const type = data ? (w ? "Arma" : itemTypeName(data.type)) : null;
  const subtitle = type ? `${type}, ${data?.rarity ? rarityName(data.rarity).toLowerCase() : "común"}` : null;
  return { name: line.name, subtitle, location: ctx.location, icon: w ? "weapon" : "item", rows, mastery };
}
