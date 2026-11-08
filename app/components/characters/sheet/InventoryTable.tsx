"use client";

import { Minus, Plus, TriangleAlert } from "lucide-react";
import type { InventoryItem } from "@/lib/rules/dnd2024/sheet/sheet";
import { effectiveContainer } from "@/lib/rules/dnd2024/sheet/inventory";
import type { InventoryGroup, ItemInfo } from "@/lib/rules/dnd2024/sheet/inventoryTable";
import { itemTypeName, rarityName, weaponPropertyName } from "@/lib/rules/dnd2024/sheet/labels";
import type { SheetCustom } from "@/lib/rules/dnd2024/sheet/custom";
import OrderedSection from "./OrderedSection";
import { switchThumb, switchTrack, tagChip } from "./statUi";

const LB_TO_KG = 0.4536;
export const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });
export const weightText = (lb: number) => `${fmt(lb)} lb (${fmt(lb * LB_TO_KG)} kg)`;

export type InventoryActions = {
  quantity: (id: string, quantity: number) => void;
  notes: (id: string, notes: string) => void;
  equip: (id: string, equipped: boolean) => void;
  move: (id: string, container: string | null) => void;
  remove: (id: string) => void;
};

const goldText = (copper: number) => `${fmt(copper / 100)} po`;
// Columnas de las filas y de la barra de su grupo: objeto | peso | cantidad
const columns = "w-16 shrink-0 text-center";
const qtyColumn = "w-24 shrink-0 text-center";
const qtyButton = "flex h-7 w-7 items-center justify-center bg-line/60 text-fg transition-colors enabled:hover:bg-line disabled:opacity-40";

// Texto del encabezado de un contenedor: «Mochila (3) — 12 lb (12/30 lb)»; sin capacidad en peso, la que trae el catálogo
export function containerTitle(g: InventoryGroup) {
  const c = g.container!;
  const used = `${fmt(c.weight)} lb`;
  const capacity = c.capacity.weight !== null ? ` (${fmt(c.weight)}/${fmt(c.capacity.weight)} lb)` : c.capacity.text ? ` (${c.capacity.text})` : "";
  return `${g.title} (${g.lines.length}) — ${used}${capacity}`;
}

// Un grupo del inventario: «Equipo» o un contenedor. Lo que el filtro oculta sigue en el DOM (`hidden print:…`) para imprimir.
export default function InventoryTable({ group, shown, info, items, readOnly, actions, onOpen, custom, characterId, onAdd }: {
  group: InventoryGroup;
  /** Si el grupo pasa el filtro y los ids de sus líneas visibles. */
  shown: Set<string> | null;
  info: Record<string, ItemInfo | undefined>;
  items: InventoryItem[];
  readOnly: boolean;
  actions: Pick<InventoryActions, "equip" | "quantity">;
  /** Abre la ficha del objeto; `from` es el botón del nombre (recibe el foco al cerrarla). */
  onOpen: (id: string, from: HTMLElement) => void;
  custom: SheetCustom;
  characterId: string;
  /** El «+» de la sección: abre la gestión del inventario. */
  onAdd?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const c = group.container;
  const total = group.lines.reduce((sum, l) => sum + (info[l.id]?.weight ?? 0) * l.quantity, 0);
  return (
    <OrderedSection
      id={`inventario:${group.id}`}
      title={c ? containerTitle(group) : group.title}
      className={shown ? "" : "hidden print:block"}
      extra={(
        <>
          {!c && `${fmt(total)} lb`}
          {c?.over && (
            <span className="inline-flex items-center gap-1 font-semibold text-brand-soft">
              <TriangleAlert size={14} aria-hidden="true" /> Sobrecargado
            </span>
          )}
          {c && info[c.line.id]?.container?.weightless && "No cuenta para el peso cargado"}
        </>
      )}
      columns={(
        <>
          <span className={`${columns} hidden sm:block`}>Peso</span>
          <span className={`${qtyColumn} hidden sm:block`}>Cant.</span>
        </>
      )}
      rows={group.lines.map((l) => ({
        key: l.id,
        label: l.name,
        className: shown?.has(l.id) ? "" : "hidden print:flex",
        node: <Row line={l} data={info[l.id]} where={effectiveContainer(l, items, info)} readOnly={readOnly} actions={actions} onOpen={onOpen} />,
      }))}
      custom={custom}
      characterId={characterId}
      isOwner={!readOnly}
      canHide={false}
      onAdd={onAdd}
      empty="Sin objetos."
    />
  );
}

function Row({ line: l, data, where, readOnly, actions, onOpen }: {
  line: InventoryItem;
  data: ItemInfo | undefined;
  /** Id del contenedor donde está la línea; `null` = suelta. */
  where: string | null;
  readOnly: boolean;
  actions: Pick<InventoryActions, "equip" | "quantity">;
  onOpen: (id: string, from: HTMLElement) => void;
}) {
  const tags = [
    ...(data?.properties.map(weaponPropertyName) ?? []),
    ...(data?.rarity ? [rarityName(data.rarity)] : []),
    ...(data && data.value > 0 ? [goldText(data.value)] : []),
  ];
  const canEquip = where === null && !!data?.equippable;
  const weight = data ? data.weight * l.quantity : 0;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
      {canEquip && (readOnly ? (
        <span className={`shrink-0 text-xs font-semibold ${l.equipped ? "text-success" : "text-muted"}`}>{l.equipped ? "Equipado" : "—"}</span>
      ) : (
        <label className={`${switchTrack} print:hidden`}>
          <input
            type="checkbox"
            className="peer sr-only"
            checked={l.equipped}
            aria-label={`Equipar ${l.name}`}
            onChange={(e) => actions.equip(l.id, e.target.checked)}
          />
          <span aria-hidden="true" className={switchThumb} />
        </label>
      ))}
      <div className="min-w-40 flex-1">
        <button
          type="button"
          onClick={(e) => onOpen(l.id, e.currentTarget)}
          className="inline-block rounded-sm text-left font-semibold text-white underline-offset-2 hover:text-brand-soft hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {l.name}
        </button>
        {data?.type && <span className="block text-xs text-muted">{itemTypeName(data.type)}</span>}
        {tags.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {tags.map((t) => <span key={t} className={tagChip}>{t}</span>)}
          </span>
        )}
        {l.notes && <span className="mt-1 block text-xs text-muted">{l.notes}</span>}
      </div>
      <span title={data ? weightText(weight) : undefined} className={`${columns} text-sm font-semibold text-muted`}>
        {data && data.weight > 0 ? `${fmt(weight)} lb` : "—"}
      </span>
      <div className={qtyColumn}>
        {readOnly ? <span className="font-semibold">{l.quantity}</span> : (
          <>
            <span className="inline-flex items-center overflow-hidden rounded-md border border-line print:hidden">
              <button type="button" className={qtyButton} disabled={l.quantity <= 1} aria-label={`Quitar una unidad de ${l.name}`} onClick={() => actions.quantity(l.id, l.quantity - 1)}>
                <Minus size={14} aria-hidden="true" />
              </button>
              <span className="w-9 text-center text-sm font-semibold text-white" aria-label={`Cantidad de ${l.name}`}>{l.quantity}</span>
              <button type="button" className={qtyButton} aria-label={`Añadir una unidad de ${l.name}`} onClick={() => actions.quantity(l.id, l.quantity + 1)}>
                <Plus size={14} aria-hidden="true" />
              </button>
            </span>
            <span className="hidden font-semibold print:inline">{l.quantity}</span>
          </>
        )}
      </div>
    </div>
  );
}
