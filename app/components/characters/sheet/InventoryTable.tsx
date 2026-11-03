"use client";

import { TriangleAlert } from "lucide-react";
import type { InventoryItem } from "@/lib/rules/dnd2024/sheet/sheet";
import { effectiveContainer } from "@/lib/rules/dnd2024/sheet/inventory";
import type { InventoryGroup, ItemInfo } from "@/lib/rules/dnd2024/sheet/inventoryTable";
import { itemTypeName, rarityName, weaponPropertyName } from "@/lib/rules/dnd2024/sheet/labels";

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

// Texto del encabezado de un contenedor: «Mochila (3) — 12 lb (12/30 lb)»; sin capacidad en peso, la que trae el catálogo
export function containerTitle(g: InventoryGroup) {
  const c = g.container!;
  const used = `${fmt(c.weight)} lb`;
  const capacity = c.capacity.weight !== null ? ` (${fmt(c.weight)}/${fmt(c.capacity.weight)} lb)` : c.capacity.text ? ` (${c.capacity.text})` : "";
  return `${g.title} (${g.lines.length}) — ${used}${capacity}`;
}

// Un grupo de la tabla: «Equipo» o un contenedor. Lo que el filtro oculta sigue en el DOM (`hidden print:…`) para imprimir.
export default function InventoryTable({ group, shown, info, items, readOnly, actions, onOpen }: {
  group: InventoryGroup;
  /** Si el grupo pasa el filtro y los ids de sus líneas visibles. */
  shown: Set<string> | null;
  info: Record<string, ItemInfo | undefined>;
  items: InventoryItem[];
  readOnly: boolean;
  actions: Pick<InventoryActions, "equip">;
  /** Abre la ficha del objeto; `from` es el botón del nombre (recibe el foco al cerrarla). */
  onOpen: (id: string, from: HTMLElement) => void;
}) {
  const c = group.container;
  return (
    <section aria-label={group.title} className={shown ? "" : "hidden print:block"}>
      <h4 className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-heading text-sm font-bold text-brand-soft">
        {c ? containerTitle(group) : group.title}
        {c?.over && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-soft">
            <TriangleAlert size={14} aria-hidden="true" /> Sobrecargado
          </span>
        )}
        {c && info[c.line.id]?.container?.weightless && (
          <span className="text-xs font-normal text-muted">No cuenta para el peso cargado</span>
        )}
      </h4>
      {group.lines.length === 0 ? (
        <p className="text-sm text-muted">Sin objetos.</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-176 text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="pb-2 pr-3 font-semibold">Activo</th>
                <th className="pb-2 pr-3 font-semibold">Nombre</th>
                <th className="pb-2 pr-3 font-semibold">Peso</th>
                <th className="pb-2 pr-3 font-semibold">Cant.</th>
                <th className="pb-2 pr-3 font-semibold">Coste</th>
                <th className="pb-2 pr-3 font-semibold">Notas</th>
              </tr>
            </thead>
            <tbody>
              {group.lines.map((l) => (
                <Row
                  key={l.id}
                  line={l}
                  data={info[l.id]}
                  where={effectiveContainer(l, items, info)}
                  visible={shown?.has(l.id) ?? false}
                  readOnly={readOnly}
                  actions={actions}
                  onOpen={onOpen}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Row({ line: l, data, where, visible, readOnly, actions, onOpen }: {
  line: InventoryItem;
  data: ItemInfo | undefined;
  /** Id del contenedor donde está la línea; `null` = suelta. */
  where: string | null;
  visible: boolean;
  readOnly: boolean;
  actions: Pick<InventoryActions, "equip">;
  onOpen: (id: string, from: HTMLElement) => void;
}) {
  const props = data?.properties.map(weaponPropertyName).join(", ");
  const details = [props, data?.rarity ? rarityName(data.rarity) : ""].filter(Boolean).join(" · ");
  const inContainer = where !== null;
  return (
    <tr className={`border-t border-line align-middle ${visible ? "" : "hidden print:table-row"}`}>
      <td className="py-2 pr-3">
        {inContainer || !data?.equippable ? (
          <span className="text-muted" aria-hidden="true">{inContainer ? "—" : "-"}</span>
        ) : readOnly ? (
          <span className={l.equipped ? "" : "text-muted"}>{l.equipped ? "Sí" : "—"}</span>
        ) : (
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand"
            checked={l.equipped}
            aria-label={`Equipar ${l.name}`}
            onChange={(e) => actions.equip(l.id, e.target.checked)}
          />
        )}
      </td>
      <td className="py-2 pr-3">
        <button
          type="button"
          onClick={(e) => onOpen(l.id, e.currentTarget)}
          className="rounded-sm text-left font-semibold underline-offset-2 hover:text-brand-soft hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {l.name}
        </button>
        {data?.type && <span className="block text-xs text-muted">{itemTypeName(data.type)}</span>}
      </td>
      <td className="whitespace-nowrap py-2 pr-3 text-muted">
        {data ? (
          <>
            {weightText(data.weight)}
            {l.quantity > 1 && data.weight > 0 && <span className="block text-xs">total {weightText(data.weight * l.quantity)}</span>}
          </>
        ) : "-"}
      </td>
      <td className="py-2 pr-3">{l.quantity}</td>
      <td className="whitespace-nowrap py-2 pr-3 text-muted">{data && data.value > 0 ? goldText(data.value) : "—"}</td>
      <td className="py-2 pr-3">
        {details && <span className="mb-1 block text-xs text-muted">{details}</span>}
        <span className="text-muted">{l.notes}</span>
      </td>
    </tr>
  );
}
