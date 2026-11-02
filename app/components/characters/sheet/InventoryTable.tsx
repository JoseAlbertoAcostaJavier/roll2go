"use client";

import { useState } from "react";
import { TriangleAlert, X } from "lucide-react";
import type { InventoryItem } from "@/lib/rules/dnd2024/sheet/sheet";
import { MAX_ITEM_NOTES, MAX_QUANTITY } from "@/lib/rules/dnd2024/sheet/edits";
import { effectiveContainer } from "@/lib/rules/dnd2024/sheet/inventory";
import type { InventoryGroup, ItemInfo } from "@/lib/rules/dnd2024/sheet/inventoryTable";
import { itemTypeName, rarityName, weaponPropertyName } from "@/lib/rules/dnd2024/sheet/labels";

const LB_TO_KG = 0.4536;
export const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });
export const weightText = (lb: number) => `${fmt(lb)} lb (${fmt(lb * LB_TO_KG)} kg)`;
export const smallInput =
  "h-8 rounded-md border border-line bg-surface px-2 text-sm text-fg focus:border-brand focus:outline-none disabled:opacity-60";
export const clampInt = (v: string, max: number, fallback: number) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && v.trim() !== "" ? Math.min(max, Math.max(0, n)) : fallback;
};

export type InventoryActions = {
  quantity: (id: string, quantity: number) => void;
  notes: (id: string, notes: string) => void;
  equip: (id: string, equipped: boolean) => void;
  move: (id: string, container: string | null) => void;
  remove: (id: string) => void;
};

const goldText = (copper: number) => `${fmt(copper / 100)} po`;

// Texto del encabezado de un contenedor: «Mochila (3) — 12 lb (12/30 lb)»; sin capacidad en peso, la que trae el catálogo
function containerTitle(g: InventoryGroup) {
  const c = g.container!;
  const used = `${fmt(c.weight)} lb`;
  const capacity = c.capacity.weight !== null ? ` (${fmt(c.weight)}/${fmt(c.capacity.weight)} lb)` : c.capacity.text ? ` (${c.capacity.text})` : "";
  return `${g.title} (${g.lines.length}) — ${used}${capacity}`;
}

// Un grupo de la tabla: «Equipo» o un contenedor. Lo que el filtro oculta sigue en el DOM (`hidden print:…`) para imprimir.
export default function InventoryTable({ group, shown, info, items, readOnly, containers, actions }: {
  group: InventoryGroup;
  /** Si el grupo pasa el filtro y los ids de sus líneas visibles. */
  shown: Set<string> | null;
  info: Record<string, ItemInfo | undefined>;
  items: InventoryItem[];
  readOnly: boolean;
  /** Líneas contenedoras (destinos de «Mover a…»). */
  containers: InventoryItem[];
  actions: InventoryActions;
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-176 text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="pb-2 pr-3 font-semibold">Activo</th>
                <th className="pb-2 pr-3 font-semibold">Nombre</th>
                <th className="pb-2 pr-3 font-semibold">Peso</th>
                <th className="pb-2 pr-3 font-semibold">Cant.</th>
                <th className="pb-2 pr-3 font-semibold">Coste</th>
                <th className="pb-2 pr-3 font-semibold">Notas</th>
                {!readOnly && <th className="pb-2 font-semibold print:hidden"><span className="sr-only">Mover y quitar</span></th>}
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
                  containers={containers}
                  actions={actions}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Row({ line: l, data, where, visible, readOnly, containers, actions }: {
  line: InventoryItem;
  data: ItemInfo | undefined;
  /** Id del contenedor donde está la línea; `null` = suelta. */
  where: string | null;
  visible: boolean;
  readOnly: boolean;
  containers: InventoryItem[];
  actions: InventoryActions;
}) {
  const props = data?.properties.map(weaponPropertyName).join(", ");
  const details = [props, data?.rarity ? rarityName(data.rarity) : ""].filter(Boolean).join(" · ");
  const inContainer = where !== null;
  const targets = containers.filter((k) => k.id !== l.id);
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
        <span className="font-semibold">{l.name}</span>
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
      <td className="py-2 pr-3">
        {readOnly ? l.quantity : (
          <QuantityField label={`Cantidad de ${l.name}`} value={l.quantity} onCommit={(q) => actions.quantity(l.id, q)} />
        )}
      </td>
      <td className="whitespace-nowrap py-2 pr-3 text-muted">{data && data.value > 0 ? goldText(data.value) : "—"}</td>
      <td className="py-2 pr-3">
        {details && <span className="mb-1 block text-xs text-muted">{details}</span>}
        {readOnly ? <span className="text-muted">{l.notes}</span> : (
          <NotesField label={`Notas de ${l.name}`} value={l.notes} onCommit={(notes) => actions.notes(l.id, notes)} />
        )}
      </td>
      {!readOnly && (
        <td className="whitespace-nowrap py-2 text-right print:hidden">
          {!data?.container && targets.length > 0 && (
            <select
              aria-label={`Mover ${l.name} a…`}
              value={where ?? ""}
              onChange={(e) => actions.move(l.id, e.target.value || null)}
              className={`${smallInput} mr-1 max-w-40`}
            >
              <option value="">Equipo</option>
              {targets.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          )}
          <button
            type="button"
            aria-label={`Quitar ${l.name}`}
            onClick={() => actions.remove(l.id)}
            className="rounded-md p-1.5 text-muted transition-colors hover:text-brand-soft"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </td>
      )}
    </tr>
  );
}

// Campos con borrador propio: se guardan al salir del campo o con Intro
function QuantityField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(String(value));
  }
  const commit = () => {
    const v = clampInt(draft, MAX_QUANTITY, value);
    setDraft(String(v));
    if (v !== value) onCommit(v);
  };
  return (
    <input
      type="number" inputMode="numeric" min={0} max={MAX_QUANTITY} aria-label={label}
      className={`${smallInput} w-20`} value={draft}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()}
    />
  );
}

function NotesField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(value);
  }
  return (
    <input
      type="text" aria-label={label} maxLength={MAX_ITEM_NOTES} className={`${smallInput} w-full`} value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}
