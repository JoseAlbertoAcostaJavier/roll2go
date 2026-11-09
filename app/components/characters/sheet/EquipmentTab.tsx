"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, SlidersHorizontal, TriangleAlert } from "lucide-react";
import type { Coins, Inventory } from "@/lib/rules/dnd2024/sheet/sheet";
import { MAX_ATTUNED, MAX_COINS, MAX_OTHER, type InventoryOp } from "@/lib/rules/dnd2024/sheet/edits";
import { effectiveContainer, inventoryWeights } from "@/lib/rules/dnd2024/sheet/inventory";
import { itemDetails, locationText, type ItemDetails } from "@/lib/rules/dnd2024/sheet/itemDetails";
import { attunementLines, inventoryChips, inventoryGroups, type ItemInfo } from "@/lib/rules/dnd2024/sheet/inventoryTable";
import { rarityName } from "@/lib/rules/dnd2024/sheet/labels";
import { parseSection } from "@/lib/rules/dnd2024/sheet/sheetSections";
import type { NewItem } from "./AddItemDialog";
import InventoryFilters from "./InventoryFilters";
import { clampInt, smallInput } from "./InventoryFields";
import ItemDialog, { type ItemOwnerControls } from "./ItemDialog";
import ManageInventory from "./ManageInventory";
import type { SheetCustom } from "@/lib/rules/dnd2024/sheet/custom";
import InventoryTable, { fmt, weightText, type InventoryActions } from "./InventoryTable";
import { SectionBar, switchThumb, switchTrack, tagChip } from "./statUi";

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
  custom: SheetCustom;
};

const COINS: { key: keyof Coins; label: string }[] = [
  { key: "cp", label: "Cobre" }, { key: "sp", label: "Plata" }, { key: "ep", label: "Electro" }, { key: "gp", label: "Oro" }, { key: "pp", label: "Platino" },
];
const goldValue = (c: Coins) => c.pp * 10 + c.gp + c.ep / 2 + c.sp / 10 + c.cp / 100;
const toDraft = (c: Coins) => ({ cp: String(c.cp), sp: String(c.sp), ep: String(c.ep), gp: String(c.gp), pp: String(c.pp) });
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// Pestaña Equipo: inventario, monedas, peso y otras posesiones. Edita el dueño; el resto solo lee.
export default function EquipmentTab({ characterId, isOwner, inventory, info, capacity, armorWarning, systemId, books, base, query, details, descriptions, custom }: Props) {
  const router = useRouter();
  const [inv, setInv] = useState(inventory);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(0);
  const [open, setOpen] = useState<{ id: string; opener: HTMLElement } | null>(null);
  const [manage, setManage] = useState<HTMLElement | null>(null);
  const manageButton = useRef<HTMLButtonElement>(null);
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
  // Ficha del objeto abierto: cantidad y notas salen del inventario optimista; una línea recién añadida (aún sin datos
  // del servidor) se arma con lo que se sabe de ella
  const openLine = open ? inv.items.find((l) => l.id === open.id) : undefined;
  const where = openLine ? locationText(openLine, inv.items, info) : "";
  const card = openLine
    ? liveCard(details[openLine.id] ?? itemDetails(openLine, undefined, { capacityText: null, location: where }), openLine, where)
    : null;
  // Controles de la ficha (solo el dueño): «Mover» no en los contenedores ni a donde ya está
  let owner: ItemOwnerControls | undefined;
  if (openLine && !readOnly) {
    const here = effectiveContainer(openLine, inv.items, info);
    const targets: { id: string | null; name: string }[] = info[openLine.id] && !info[openLine.id].container ? [
      ...(here !== null ? [{ id: null, name: "Equipo" }] : []),
      ...inv.items.filter((x) => info[x.id]?.container && x.id !== here && x.id !== openLine.id).map((x) => ({ id: x.id, name: x.name })),
    ] : [];
    owner = {
      quantity: openLine.quantity,
      onQuantity: (q) => actions.quantity(openLine.id, q),
      targets,
      onMove: (to) => actions.move(openLine.id, to),
      // La línea desaparece con su nombre: el foco pasa al botón «Gestionar inventario» en vez de quedar en el <body>
      onRemove: () => {
        actions.remove(openLine.id);
        requestAnimationFrame(() => manageButton.current?.focus());
      },
    };
  }
  const magic = attunementLines(inv.items, info);
  const attuned = inv.items.filter((l) => l.attuned).length;
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

      <section className="animate-fade-up space-y-3" aria-label="Inventario">
        <CoinsEditor coins={inv.coins} readOnly={readOnly} onCommit={(coins) => send({ op: "coins", coins }, (i) => ({ ...i, coins }))} />

        <InventoryFilters
          base={base} query={query} chips={chips} active={active} q={q}
          action={readOnly ? undefined : (
            <button
              ref={manageButton}
              type="button"
              onClick={(e) => setManage(e.currentTarget)}
              className="flex shrink-0 items-center gap-2 rounded-md border border-line-strong px-3 py-2 font-heading text-sm font-bold text-fg transition-colors hover:border-fg"
            >
              <SlidersHorizontal size={16} aria-hidden="true" /> Gestionar inventario
            </button>
          )}
        />
        <p className={`text-sm font-semibold ${over ? "text-brand-soft" : "text-fg"}`}>
          Peso total: {weightText(carried)} <span className="font-normal text-muted">de {weightText(capacity)}</span>
          {over && (
            <span className="ml-2 inline-flex items-center gap-1" role="status">
              <TriangleAlert size={14} aria-hidden="true" /> Supera la capacidad de carga
            </span>
          )}
          <span className="ml-3 font-normal text-muted">Monedas: {fmt(goldValue(inv.coins))} po</span>
          {saving > 0 && <LoaderCircle size={14} aria-label="Guardando" className="ml-2 inline animate-spin text-muted" />}
        </p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}

        <div className={`space-y-5 ${section(active !== "otras")}`}>
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
                custom={custom}
                characterId={characterId}
                onAdd={readOnly ? undefined : (e) => setManage(e.currentTarget)}
              />
            );
          })}
        </div>
      </section>

      {manage && !readOnly && (
        <ManageInventory
          inv={inv}
          info={info}
          actions={actions}
          systemId={systemId}
          books={books}
          onAdd={(item: NewItem) => send({ op: "add", ...item })}
          onClose={() => setManage(null)}
          error={error}
          saving={saving > 0}
          opener={manage}
        />
      )}

      {card && open && (
        <ItemDialog
          details={card}
          description={descriptions[open.id] ?? ""}
          onClose={() => setOpen(null)}
          opener={open.opener}
          owner={owner}
        />
      )}

      {/* Sintonización: los objetos que la requieren, con su interruptor */}
      <section className={`animate-fade-up space-y-1 ${section(active === "todo")}`} aria-label="Sintonización">
        <SectionBar title="Sintonización" extra={`${attuned}/${MAX_ATTUNED}`} />
        {magic.length === 0 ? <p className="px-3 py-2 text-sm text-muted">Sin objetos que requieran sintonización.</p> : (
          <ul className="divide-y divide-line">
            {magic.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                {readOnly ? <span className={`text-xs font-semibold ${l.attuned ? "text-success" : "text-muted"}`}>{l.attuned ? "Sintonizado" : "—"}</span> : (
                  <label className={`${switchTrack} print:hidden`} title={!l.attuned && attuned >= MAX_ATTUNED ? `Solo puedes sintonizar ${MAX_ATTUNED} objetos a la vez` : undefined}>
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={!!l.attuned}
                      disabled={!l.attuned && attuned >= MAX_ATTUNED}
                      aria-label={`Sintonizar ${l.name}`}
                      onChange={(e) => send({ op: "update", id: l.id, attuned: e.target.checked }, patchLine(l.id, { attuned: e.target.checked }))}
                    />
                    <span aria-hidden="true" className={switchThumb} />
                  </label>
                )}
                <span className="font-semibold text-white">{l.name}</span>
                {info[l.id]?.rarity && <span className={tagChip}>{rarityName(info[l.id]!.rarity!)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`animate-fade-up space-y-2 ${section(active === "todo" || active === "otras")}`} aria-label="Otras posesiones">
        <SectionBar title="Otras posesiones" />
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
    <ul className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md bg-surface px-3 py-2">
      {COINS.map(({ key, label }) => (
        <li key={key} className="flex items-center gap-1.5">
          <label htmlFor={`coin-${key}`} className="text-xs font-semibold text-fg">{label}:</label>
          {readOnly ? <p className="font-heading font-bold">{coins[key]}</p> : (
            <input
              id={`coin-${key}`} type="number" inputMode="numeric" min={0} max={MAX_COINS}
              className={`${smallInput} w-16 text-center`} value={draft[key]}
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
      className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
    />
  );
}

// Pone en la ficha la cantidad y las notas actuales de la línea
function liveCard(card: ItemDetails, line: Inventory["items"][number], location: string): ItemDetails {
  const rows = card.rows.filter((r) => r.label !== "Cantidad" && r.label !== "Notas");
  rows.push({ label: "Cantidad", value: String(line.quantity) });
  if (line.notes.trim()) rows.push({ label: "Notas", value: line.notes });
  return { ...card, rows, location };
}
