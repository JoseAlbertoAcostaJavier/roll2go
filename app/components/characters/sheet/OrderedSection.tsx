"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Minus, Plus } from "lucide-react";
import MaskIcon from "@/app/components/ui/MaskIcon";
import { sheetUiSrc } from "@/lib/utils/icons";
import { ordered, type SheetCustom } from "@/lib/rules/dnd2024/sheet/custom";
import type { CustomItem } from "@/lib/rules/dnd2024/sheet/sheet";
import CustomItemForm from "./CustomItemForm";
import { SectionBar } from "./statUi";

export type OrderedRow = {
  key: string;
  /** Nombre, para los botones y la lista de ocultos. */
  label: string;
  node: ReactNode;
  /** Id del elemento personalizado: «quitar» lo borra en vez de ocultarlo. */
  customId?: string;
  /** Texto para el buscador de la pestaña. */
  search?: string;
  className?: string;
};

export async function customOp(characterId: string, op: object): Promise<string | null> {
  try {
    const res = await fetch(`/api/characters/${characterId}/custom`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(op),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.error ?? `El servidor ha respondido con un error (${res.status}).`;
  } catch {
    return "No se pudo conectar con el servidor.";
  }
}

const iconButton = "rounded p-0.5 text-muted transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-brand print:hidden";

// Sección de una pestaña de la ficha: barra con candado y «+». Abierto el candado, las filas se arrastran (o se mueven con
// las flechas sobre el asa) y se quitan: las personalizadas se borran y las demás se ocultan, con vuelta atrás. El orden y
// los ocultos se guardan en la hoja.
export default function OrderedSection({ id, title, extra, columns, rows, custom, characterId, isOwner, add, onAdd, canHide = true, empty, className = "", listClass = "divide-y divide-line" }: {
  id: string;
  title: string;
  extra?: ReactNode;
  /** Rótulos de columna, a la derecha de la barra. */
  columns?: ReactNode;
  rows: OrderedRow[];
  custom: Pick<SheetCustom, "order" | "hidden">;
  characterId: string;
  isOwner: boolean;
  /** Formulario que abre el «+». */
  add?: { kind: CustomItem["kind"]; group?: string };
  /** O una acción propia para el «+» (añadir un objeto). */
  onAdd?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Sin «quitar» (las líneas del inventario se quitan desde su ficha). */
  canHide?: boolean;
  empty?: string;
  className?: string;
  listClass?: string;
}) {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);
  const [adding, setAdding] = useState(false);
  const [order, setOrder] = useState(custom.order[id]);
  const [hidden, setHidden] = useState(custom.hidden);
  const [error, setError] = useState("");
  const dragging = useRef<string | null>(null);

  const all = ordered(rows, order);
  const shown = all.filter((r) => !hidden.includes(r.key));
  const hiddenRows = all.filter((r) => hidden.includes(r.key));
  const keys = shown.map((r) => r.key);

  const save = async (op: object, refresh = false) => {
    const message = await customOp(characterId, op);
    setError(message ?? "");
    if (!message && refresh) router.refresh();
    return !message;
  };

  const place = (key: string, target: number) => {
    const next = keys.filter((k) => k !== key);
    next.splice(Math.max(0, Math.min(target, next.length)), 0, key);
    setOrder(next);
    return next;
  };

  const remove = (r: OrderedRow) => {
    if (r.customId) return void save({ op: "removeItem", id: r.customId }, true);
    setHidden((h) => [...h, r.key]);
    void save({ op: "hide", key: r.key, hidden: true });
  };
  const restore = (r: OrderedRow) => {
    setHidden((h) => h.filter((k) => k !== r.key));
    void save({ op: "hide", key: r.key, hidden: false });
  };

  const hasControls = isOwner && (rows.length > 1 || (canHide && rows.length > 0));
  return (
    <section data-search-group className={className} aria-label={title}>
      <SectionBar
        title={title}
        extra={extra}
        lead={hasControls ? (
          <button
            type="button"
            aria-pressed={unlocked}
            aria-label={unlocked ? `Bloquear ${title}` : `Desbloquear ${title} para ordenarla`}
            title={unlocked ? "Bloquear" : "Ordenar"}
            onClick={() => setUnlocked((u) => !u)}
            className={`${iconButton} ${unlocked ? "text-brand-soft" : ""}`}
          >
            <MaskIcon src={sheetUiSrc(unlocked ? "padlock-open" : "padlock")} size={15} />
          </button>
        ) : undefined}
      >
        {columns}
        {isOwner && (add || onAdd) && (
          <button
            type="button"
            aria-label={`Añadir a ${title}`}
            title="Añadir"
            aria-expanded={add ? adding : undefined}
            onClick={(e) => (onAdd ? onAdd(e) : setAdding((a) => !a))}
            className={iconButton}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        )}
      </SectionBar>

      {adding && add && <CustomItemForm characterId={characterId} kind={add.kind} group={add.group} onClose={() => setAdding(false)} />}
      {error && <p role="alert" className="mt-1 px-3 text-xs text-danger">{error}</p>}

      {shown.length === 0 && !adding && empty && <p className="px-3 py-3 text-sm text-muted">{empty}</p>}
      {shown.length > 0 && (
        <ul className={`${listClass} ${unlocked ? "mt-1 rounded-md border border-dashed border-line-strong" : ""}`}>
          {shown.map((r, i) => (
            <li
              key={r.key}
              data-search={r.search ?? r.label}
              draggable={unlocked}
              onDragStart={(e) => {
                dragging.current = r.key;
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!unlocked || !dragging.current) return;
                e.preventDefault();
                if (dragging.current !== r.key) place(dragging.current, i);
              }}
              onDragEnd={() => {
                dragging.current = null;
                void save({ op: "order", section: id, keys });
              }}
              className={`flex items-stretch gap-1 ${unlocked ? "cursor-grab" : ""} ${r.className ?? ""}`}
            >
              {unlocked && (
                <button
                  type="button"
                  aria-label={`Mover ${r.label}: usa las flechas`}
                  title="Arrastra o usa las flechas"
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                    e.preventDefault();
                    const next = place(r.key, i + (e.key === "ArrowUp" ? -1 : 1));
                    void save({ op: "order", section: id, keys: next });
                  }}
                  className="flex shrink-0 cursor-grab items-center pl-1 text-muted hover:text-white focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <GripVertical size={16} aria-hidden="true" />
                </button>
              )}
              <div className="min-w-0 flex-1">{r.node}</div>
              {unlocked && (canHide || r.customId) && (
                <button
                  type="button"
                  aria-label={r.customId ? `Borrar ${r.label}` : `Ocultar ${r.label}`}
                  title={r.customId ? "Borrar" : "Ocultar"}
                  onClick={() => remove(r)}
                  className="mx-1 flex size-6 shrink-0 items-center justify-center self-center rounded-full border border-danger text-danger transition-colors hover:bg-danger/15 focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <Minus size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {unlocked && hiddenRows.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 px-3 text-xs text-muted print:hidden">
          Ocultos:
          {hiddenRows.map((r) => (
            <button key={r.key} type="button" onClick={() => restore(r)} className="rounded border border-line px-1.5 py-0.5 text-fg hover:border-fg" title="Volver a mostrar">
              {r.label}
            </button>
          ))}
        </p>
      )}
    </section>
  );
}
