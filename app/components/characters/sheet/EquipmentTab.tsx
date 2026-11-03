"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import type { Coins, Inventory } from "@/lib/rules/dnd2024/sheet/sheet";
import { MAX_COINS, MAX_OTHER, type InventoryOp } from "@/lib/rules/dnd2024/sheet/edits";
import { inventoryWeights } from "@/lib/rules/dnd2024/sheet/inventory";
import type { ItemDetails } from "@/lib/rules/dnd2024/sheet/itemDetails";
import { inventoryChips, inventoryGroups, type ItemInfo } from "@/lib/rules/dnd2024/sheet/inventoryTable";
import { parseSection } from "@/lib/rules/dnd2024/sheet/sheetSections";
import { sheetCard, cardTitle } from "@/app/components/ui/formStyles";
import AddItemDialog, { type NewItem } from "./AddItemDialog";
import InventoryFilters from "./InventoryFilters";
import { clampInt, smallInput } from "./InventoryFields";
import ItemDialog from "./ItemDialog";
import InventoryTable, { fmt, weightText, type InventoryActions } from "./InventoryTable";

export type { ItemInfo };

type Query = Record<string, string | string[] | undefined>;

type Props = {
  characterId: string;
  isOwner: boolean;
  inventory: Inventory;
  info: Record<string, ItemInfo>;
  capacity: number;
  armorWarning: string | null;
  systemId: string;
  /** Libros que puede usar el personaje (calculados en el servidor). */
  books: string[];
  /** Dirección de la ficha y sus parámetros (`?seccion=`, `?q=`). */
  base: string;
  query: Query;
  /** Datos y descripción de cada línea (clave: id de la línea) para su ficha. */
  details: Record<string, ItemDetails>;
  descriptions: Record<string, string>;
};

const COINS: { key: keyof Coins; label: string }[] = [
  { key: "pp", label: "PP" }, { key: "gp", label: "PO" }, { key: "ep", label: "PE" }, { key: "sp", label: "PL" }, { key: "cp", label: "PC" },
];
const goldValue = (c: Coins) => c.pp * 10 + c.gp + c.ep / 2 + c.sp / 10 + c.cp / 100;
const toDraft = (c: Coins) => ({ cp: String(c.cp), sp: String(c.sp), ep: String(c.ep), gp: String(c.gp), pp: String(c.pp) });
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// Pestaña Equipo: inventario, monedas, peso y otras posesiones. Edita el dueño; el resto solo lee.
export default function EquipmentTab({ characterId, isOwner, inventory, info, capacity, armorWarning, systemId, books, base, query, details, descriptions }: Props) {
  const router = useRouter();
  const [inv, setInv] = useState(inventory);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(0);
  const [open, setOpen] = useState<{ id: string; opener: HTMLElement } | null>(null);
  const saved = useRef(inventory);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);

  // Aplica el cambio al momento y lo envía; las operaciones van en fila para que la última respuesta sea la vigente.
  // Si el servidor no responde 200 se vuelve al último estado confirmado.
  function send(op: InventoryOp, optimistic?: (i: Inventory) => Inventory): Promise<string | null> {
    if (optimistic) setInv(optimistic);
    pending.current++;
    setSaving((n) => n + 1);
    const run = queue.current.then(async (): Promise<string | null> => {
      try {
        const res = await fetch(`/api/characters/${characterId}/inventory`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(op),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "No se pudo guardar el inventario.");
        saved.current = data.inventory;
        if (pending.current === 1) setInv(data.inventory);
        setError("");
        router.refresh();
        return null;
      } catch (e) {
        const message = e instanceof Error ? e.message : "No se pudo guardar el inventario.";
        if (pending.current === 1) setInv(saved.current);
        setError(message);
        return message;
      } finally {
        pending.current--;
        setSaving((n) => n - 1);
      }
    });
    queue.current = run;
    return run;
  }

  const patchLine = (id: string, patch: Partial<Inventory["items"][number]>) => (i: Inventory): Inventory => ({
    ...i,
    items: i.items.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  });

  // El servidor desequipa la armadura o el escudo anterior (se refleja al llegar la respuesta); al equipar saca la línea
  // de su contenedor, al mover a uno la desequipa y al quitar un contenedor libera lo que llevaba dentro
  const actions: InventoryActions = {
    quantity: (id, quantity) => send({ op: "update", id, quantity }, patchLine(id, { quantity })),
    notes: (id, notes) => send({ op: "update", id, notes }, patchLine(id, { notes })),
    equip: (id, equipped) => send({ op: "update", id, equipped }, patchLine(id, equipped ? { equipped, container: null } : { equipped })),
    move: (id, container) => send({ op: "move", id, container }, patchLine(id, { container, equipped: false })),
    remove: (id) => send({ op: "remove", id }, (i) => ({
      ...i,
      items: i.items.filter((x) => x.id !== id).map((x) => (x.container === id ? { ...x, container: null } : x)),
    })),
  };

  const readOnly = !isOwner;
  const carried = inventoryWeights(inv.items, info).carried;
  const over = carried > capacity;

  const chips = inventoryChips(inv.items, info);
  const active = parseSection(query.seccion, chips.map((c) => c.id));
  const q = first(query.q);
  // Todo el inventario va en el DOM (se imprime entero); el filtro solo oculta en pantalla
  const all = inventoryGroups(inv.items, info, "todo", "");
  const shown = new Map(inventoryGroups(inv.items, info, active, q).map((g) => [g.id, g]));
  const shownLines = [...shown.values()].reduce((n, g) => n + g.lines.length, 0);
  const nothing = shownLines === 0 && (q.trim() !== "" || active === "equipado" || ![...shown.values()].some((g) => g.container));
  const section = (on: boolean) => (on ? "" : "hidden print:block");

  return (
    <div className="space-y-6">
      {armorWarning && (
        <p role="status" className="flex items-start gap-2 rounded-md border border-line bg-surface p-3 text-sm text-muted">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-brand-soft" aria-hidden="true" />
          <span>{armorWarning}</span>
        </p>
      )}

      <section className={`${sheetCard} animate-fade-up`} aria-labelledby="inventory-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 id="inventory-title" className={`${cardTitle} mb-0`}>
            Inventario
            {saving > 0 && <LoaderCircle size={14} aria-label="Guardando" className="ml-2 inline animate-spin text-muted" />}
          </h3>
          {!readOnly && (
            <div className="print:hidden">
              <AddItemDialog
                systemId={systemId}
                books={books}
                onAdd={(item: NewItem) => send({ op: "add", ...item })}
              />
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <p className={over ? "font-semibold text-brand-soft" : "text-muted"}>
            Peso cargado: {weightText(carried)} de {weightText(capacity)}
            {over && (
              <span className="ml-2 inline-flex items-center gap-1" role="status">
                <TriangleAlert size={14} aria-hidden="true" /> Supera la capacidad de carga
              </span>
            )}
          </p>
          <p className="text-muted">Monedas: {fmt(goldValue(inv.coins))} po</p>
        </div>

        <InventoryFilters base={base} query={query} chips={chips} active={active} q={q} />
        {error && <p role="alert" className="mb-3 text-sm text-brand-soft">{error}</p>}

        <div className={`space-y-6 ${section(active !== "otras")}`}>
          {nothing && active !== "otras" && <p className="text-sm text-muted print:hidden">Sin objetos.</p>}
          {all.map((g) => {
            const s = nothing ? undefined : shown.get(g.id);
            return (
              <InventoryTable
                key={g.id}
                group={g}
                shown={s ? new Set(s.lines.map((l) => l.id)) : null}
                info={info}
                items={inv.items}
                readOnly={readOnly}
                actions={actions}
                onOpen={(id, opener) => setOpen({ id, opener })}
              />
            );
          })}
        </div>
      </section>

      {open && details[open.id] && (
        <ItemDialog
          details={details[open.id]}
          description={descriptions[open.id] ?? ""}
          onClose={() => setOpen(null)}
          opener={open.opener}
        />
      )}

      <section className={`${sheetCard} animate-fade-up ${section(active === "todo")}`} aria-labelledby="coins-title">
        <h3 id="coins-title" className={cardTitle}>Monedas</h3>
        <CoinsEditor coins={inv.coins} readOnly={readOnly} onCommit={(coins) => send({ op: "coins", coins }, (i) => ({ ...i, coins }))} />
        <p className="mt-3 text-sm text-muted">Total: {fmt(goldValue(inv.coins))} po</p>
      </section>

      <section className={`${sheetCard} animate-fade-up ${section(active === "todo" || active === "otras")}`} aria-labelledby="other-title">
        <h3 id="other-title" className={cardTitle}>Otras posesiones</h3>
        {readOnly ? (
          <p className="whitespace-pre-wrap text-sm">{inv.other || <span className="text-muted">Nada.</span>}</p>
        ) : (
          <OtherField value={inv.other} onCommit={(text) => send({ op: "other", text }, (i) => ({ ...i, other: text }))} />
        )}
      </section>
    </div>
  );
}

function CoinsEditor({ coins, readOnly, onCommit }: { coins: Coins; readOnly: boolean; onCommit: (c: Coins) => void }) {
  const [draft, setDraft] = useState<Record<keyof Coins, string>>(() => toDraft(coins));
  const [shown, setShown] = useState(coins);
  // Solo se repone el campo cuyo valor confirmado cambió, para no pisar lo que se está escribiendo en otro
  if (shown !== coins) {
    setShown(coins);
    const changed = COINS.filter(({ key }) => coins[key] !== shown[key]);
    if (changed.length) setDraft((d) => ({ ...d, ...Object.fromEntries(changed.map(({ key }) => [key, String(coins[key])])) }));
  }
  const commit = () => {
    const next = {} as Coins;
    for (const { key } of COINS) next[key] = clampInt(draft[key], MAX_COINS, coins[key]);
    setDraft(toDraft(next));
    if (COINS.some(({ key }) => next[key] !== coins[key])) onCommit(next);
  };
  return (
    <ul className="grid grid-cols-5 gap-2 sm:max-w-md">
      {COINS.map(({ key, label }) => (
        <li key={key} className="text-center">
          <label htmlFor={`coin-${key}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</label>
          {readOnly ? <p className="font-heading font-bold">{coins[key]}</p> : (
            <input
              id={`coin-${key}`} type="number" inputMode="numeric" min={0} max={MAX_COINS}
              className={`${smallInput} w-full text-center`} value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function OtherField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(value);
  }
  return (
    <textarea
      aria-label="Otras posesiones" rows={4} maxLength={MAX_OTHER} value={draft}
      className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
    />
  );
}
