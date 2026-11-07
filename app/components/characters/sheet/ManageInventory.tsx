"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, LoaderCircle, TriangleAlert, X } from "lucide-react";
import type { Inventory, InventoryItem } from "@/lib/rules/dnd2024/sheet/sheet";
import { effectiveContainer } from "@/lib/rules/dnd2024/sheet/inventory";
import { inventoryGroups, type InventoryGroup, type ItemInfo } from "@/lib/rules/dnd2024/sheet/inventoryTable";
import AddItemDialog, { type NewItem } from "./AddItemDialog";
import { NotesField, QuantityField } from "./InventoryFields";
import { containerTitle, fmt, type InventoryActions } from "./InventoryTable";

const smallButton =
  "rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:border-brand hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const iconButton =
  "rounded-md p-1.5 text-muted transition-colors hover:bg-surface hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

type Props = {
  inv: Inventory;
  info: Record<string, ItemInfo>;
  actions: InventoryActions;
  systemId: string;
  books: string[];
  onAdd: (item: NewItem) => Promise<string | null>;
  onClose: () => void;
  /** Mensaje de error del último guardado (vacío si no hay). */
  error: string;
  /** Hay cambios sin confirmar por el servidor. */
  saving: boolean;
  /** Botón que abrió el panel (capturado al pulsar); recibe el foco al cerrar. */
  opener: HTMLElement | null;
};

// Panel «Gestionar inventario» (spec §4): a la derecha desde `sm` y a pantalla completa por debajo. Todo se guarda al
// momento con la cola de envíos de la pestaña. Foco atrapado, Escape cierra y el foco vuelve al botón que lo abrió.
export default function ManageInventory({ inv, info, actions, systemId, books, onAdd, onClose, error, saving, opener }: Props) {
  const uid = useId();
  const box = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // Con el panel abierto, la página de detrás no se desplaza
  useEffect(() => {
    closeButton.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Al imprimir la página debe poder salir entera
    const beforePrint = () => { document.body.style.overflow = overflow; };
    const afterPrint = () => { document.body.style.overflow = "hidden"; };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [opener]);

  // Al mover o quitar, la fila (y con ella el foco) puede desaparecer: el foco se queda en el panel
  const keepFocus = () =>
    requestAnimationFrame(() => {
      if (box.current && !box.current.contains(document.activeElement)) box.current.focus();
    });
  const guarded: InventoryActions = {
    ...actions,
    move: (id, container) => {
      actions.move(id, container);
      keepFocus();
    },
    remove: (id) => {
      actions.remove(id);
      keepFocus();
    },
  };

  function onKeyDown(e: React.KeyboardEvent) {
    // Lo que ya gastó el menú «Mover» o el diálogo de añadir (Escape, Tab) no es del panel
    if (e.defaultPrevented) return;
    if (e.key === "Escape") {
      e.preventDefault();
      // Al salir del campo que se está editando se guarda lo escrito
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onClose();
    } else if (e.key === "Tab" && box.current) {
      if ((e.target as HTMLElement).closest('[role="dialog"]') !== box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), a[href]")];
      const [first, last] = [items[0], items[items.length - 1]];
      if (document.activeElement === box.current) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const groups = inventoryGroups(inv.items, info, "todo", "");
  const containers = groups.filter((g) => g.container).map((g) => ({ id: g.id, name: g.title }));

  // En `document.body`: un antepasado con `transform` (la animación de entrada de la ficha) haría que `fixed` se
  // colocara respecto a él y no a la ventana
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-fade-in justify-end bg-black/70 print:hidden"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="h-full w-full overflow-y-auto border-l border-line bg-panel outline-none sm:max-w-xl"
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-panel px-4 py-3 sm:px-6">
          <h3 id={`${uid}-title`} className="min-w-0 flex-1 font-heading text-xl font-bold">Gestionar inventario</h3>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="Cerrar" className={iconButton}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {(error || saving) && (
          <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-sm sm:px-6">
            {error && <p role="alert" className="min-w-0 flex-1 text-danger">{error}</p>}
            {saving && (
              <span className="ml-auto inline-flex items-center gap-1 text-muted" role="status">
                <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> Guardando
              </span>
            )}
          </div>
        )}

        <div className="space-y-6 p-4 sm:p-6">
          <AddItemDialog systemId={systemId} books={books} onAdd={onAdd} />
          {groups.map((g) => (
            <Group key={g.id} group={g} info={info} items={inv.items} containers={containers} actions={guarded} />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function Group({ group: g, info, items, containers, actions }: {
  group: InventoryGroup;
  info: Record<string, ItemInfo>;
  items: InventoryItem[];
  containers: { id: string; name: string }[];
  actions: InventoryActions;
}) {
  const uid = useId();
  const [details, setDetails] = useState(false);
  const c = g.container;
  const capacity = c ? (c.capacity.weight !== null ? `${fmt(c.capacity.weight)} lb` : c.capacity.text) : null;
  const loose = round2(g.lines.reduce((n, l) => n + (info[l.id]?.weight ?? 0) * l.quantity, 0));

  return (
    <section aria-labelledby={`${uid}-h`}>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h4 id={`${uid}-h`} className="min-w-0 font-heading text-sm font-bold text-brand-soft">
          {c ? containerTitle(g) : `${g.title} (${g.lines.length}) — ${fmt(loose)} lb`}
        </h4>
        {c?.over && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-soft">
            <TriangleAlert size={14} aria-hidden="true" /> Sobrecargado
          </span>
        )}
        {c && (
          <button
            type="button"
            aria-expanded={details}
            aria-controls={`${uid}-details`}
            onClick={() => setDetails((d) => !d)}
            className={`${smallButton} ml-auto inline-flex items-center gap-1`}
          >
            {details ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
            Detalles del contenedor
          </button>
        )}
      </div>

      {c && details && (
        <div id={`${uid}-details`} className="mb-2 space-y-2 rounded-md border border-line bg-surface p-3 text-sm">
          <p><span className="font-semibold">Capacidad:</span> {capacity ?? "Sin límite"}</p>
          {info[c.line.id]?.container?.weightless && <p className="text-muted">No cuenta para el peso cargado</p>}
          <button type="button" onClick={() => actions.remove(c.line.id)} className={smallButton}>Quitar contenedor</button>
        </div>
      )}

      {g.lines.length === 0 ? (
        <p className="text-sm text-muted">Sin objetos.</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {g.lines.map((l) => (
            <Row
              key={l.id}
              line={l}
              data={info[l.id]}
              where={effectiveContainer(l, items, info)}
              containers={containers}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ line: l, data, where, containers, actions }: {
  line: InventoryItem;
  data: ItemInfo | undefined;
  where: string | null;
  containers: { id: string; name: string }[];
  actions: InventoryActions;
}) {
  const uid = useId();
  const [expanded, setExpanded] = useState(false);
  const equippable = where === null && !!data?.equippable;
  // «Mover»: no en los contenedores ni si no hay contenedores; el destino no incluye donde ya está
  const targets: { id: string | null; name: string }[] = [
    ...(where !== null ? [{ id: null, name: "Equipo" }] : []),
    ...containers.filter((x) => x.id !== where && x.id !== l.id),
  ];
  // Una línea recién añadida, sin sus datos todavía, no se mueve hasta saber si es un contenedor
  const movable = !!data && !data.container && containers.length > 0 && targets.length > 0;

  return (
    <li className="px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="flex w-5 shrink-0 justify-center">
          {equippable && (
            // Casilla de 16 px con zona pulsable de 24 × 32 px (la etiqueta la reenvía a la casilla)
            <label className="relative inline-flex h-4 w-4 after:absolute after:left-1/2 after:top-1/2 after:h-8 after:w-6 after:-translate-x-1/2 after:-translate-y-1/2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={l.equipped}
                aria-label={`Equipar ${l.name}`}
                onChange={(e) => actions.equip(l.id, e.target.checked)}
              />
            </label>
          )}
        </span>
        <span className="min-w-0 flex-1 wrap-break-word text-sm font-semibold">
          {l.name}
          {l.quantity > 1 && <span className="ml-1 font-normal text-muted">×{l.quantity}</span>}
        </span>
        {movable && <MoveMenu name={l.name} targets={targets} onMove={(to) => actions.move(l.id, to)} />}
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`${uid}-more`}
          aria-label={`${expanded ? "Plegar" : "Desplegar"} ${l.name}`}
          onClick={() => setExpanded((x) => !x)}
          className={iconButton}
        >
          {expanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </button>
      </div>
      {expanded && (
        <div id={`${uid}-more`} className="mt-2 flex flex-wrap items-center gap-2 pl-7">
          <QuantityField label={`Cantidad de ${l.name}`} value={l.quantity} onCommit={(v) => actions.quantity(l.id, v)} />
          <div className="min-w-40 flex-1">
            <NotesField label={`Notas de ${l.name}`} value={l.notes} onCommit={(v) => actions.notes(l.id, v)} />
          </div>
          <button type="button" aria-label={`Quitar ${l.name}`} onClick={() => actions.remove(l.id)} className={smallButton}>Quitar</button>
        </div>
      )}
    </li>
  );
}

// Botón «Mover» con menú de destinos. El menú es `fixed` (dentro del panel) y se cierra si algo se desplaza.
export function MoveMenu({ name, targets, onMove }: {
  name: string;
  targets: { id: string | null; name: string }[];
  onMove: (to: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    const close = () => {
      if (menu.current?.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true });
      setOpen(false);
    };
    const outside = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggle() {
    const r = trigger.current?.getBoundingClientRect();
    if (r) {
      const right = window.innerWidth - r.right;
      const fits = r.bottom + 4 + targets.length * 36 + 8 <= window.innerHeight;
      setPos(fits ? { top: r.bottom + 4, right } : { bottom: window.innerHeight - r.top + 4, right });
    }
    setOpen((o) => !o);
  }
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (step) {
      e.preventDefault();
      items[(at + step + items.length) % items.length]?.focus();
    } else if (e.key === "Tab") {
      trigger.current?.focus();
      setOpen(false);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`Mover ${name}`}
        onClick={toggle}
        className={`${smallButton} inline-flex items-center gap-1`}
      >
        Mover <ChevronDown size={12} aria-hidden="true" />
      </button>
      {/* Dentro del panel (que ya está en `document.body`, sin `transform` encima), para que quede en el diálogo modal */}
      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={`Mover ${name}`}
          onKeyDown={onKeyDown}
          style={pos}
          className="fixed z-60 min-w-44 animate-fade-in rounded-md border border-line bg-panel p-1 shadow-lg"
        >
          {targets.map((t) => (
            <button
              key={t.id ?? "equipo"}
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onMove(t.id);
              }}
              className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-surface focus:bg-surface focus:outline-none"
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
