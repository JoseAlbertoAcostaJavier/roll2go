"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert, X } from "lucide-react";
import type { Coins, Inventory } from "@/lib/rules/dnd2024/sheet/sheet";
import { MAX_COINS, MAX_ITEM_NOTES, MAX_OTHER, MAX_QUANTITY, type InventoryOp } from "@/lib/rules/dnd2024/sheet/edits";
import { card, cardTitle } from "@/app/components/formStyles";
import AddItemDialog, { type NewItem } from "./AddItemDialog";

/** Datos del catálogo de cada línea (clave: id de la línea). Pesos en libras. */
export type ItemInfo = { weight: number; equippable: boolean };

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
};

const COINS: { key: keyof Coins; label: string }[] = [
  { key: "pp", label: "PP" }, { key: "gp", label: "PO" }, { key: "ep", label: "PE" }, { key: "sp", label: "PL" }, { key: "cp", label: "PC" },
];
const LB_TO_KG = 0.4536;
const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });
const weightText = (lb: number) => `${fmt(lb)} lb (${fmt(lb * LB_TO_KG)} kg)`;
const goldValue = (c: Coins) => c.pp * 10 + c.gp + c.ep / 2 + c.sp / 10 + c.cp / 100;

const smallInput =
  "h-8 rounded-md border border-line bg-surface px-2 text-sm text-fg focus:border-brand focus:outline-none disabled:opacity-60";
const clampInt = (v: string, max: number, fallback: number) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && v.trim() !== "" ? Math.min(max, Math.max(0, n)) : fallback;
};
const toDraft = (c: Coins) => ({ cp: String(c.cp), sp: String(c.sp), ep: String(c.ep), gp: String(c.gp), pp: String(c.pp) });

// Pestaña Equipo: inventario, monedas, peso y otras posesiones. Edita el dueño; el resto solo lee.
export default function EquipmentTab({ characterId, isOwner, inventory, info, capacity, armorWarning, systemId, books }: Props) {
  const router = useRouter();
  const [inv, setInv] = useState(inventory);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(0);
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

  // El servidor desequipa la armadura o el escudo anterior; se refleja al llegar la respuesta
  const toggleEquipped = (id: string, equipped: boolean) => send({ op: "update", id, equipped }, patchLine(id, { equipped }));

  const totalWeight = Math.round(inv.items.reduce((s, l) => s + (info[l.id]?.weight ?? 0) * l.quantity, 0) * 100) / 100;
  const over = totalWeight > capacity;
  const readOnly = !isOwner;

  return (
    <div className="space-y-6">
      {armorWarning && (
        <p role="status" className="flex items-start gap-2 rounded-md border border-line bg-surface p-3 text-sm text-muted">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-brand-soft" aria-hidden="true" />
          <span>{armorWarning}</span>
        </p>
      )}

      <section className={`${card} animate-fade-up`} aria-labelledby="inventory-title">
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
        {error && <p role="alert" className="mb-3 text-sm text-brand-soft">{error}</p>}

        {inv.items.length === 0 ? (
          <p className="text-sm text-muted">Sin objetos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-176 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="pb-2 pr-3 font-semibold">Objeto</th>
                  <th className="pb-2 pr-3 font-semibold">Cant.</th>
                  <th className="pb-2 pr-3 font-semibold">Peso</th>
                  <th className="pb-2 pr-3 font-semibold">Equipado</th>
                  <th className="pb-2 pr-3 font-semibold">Notas</th>
                  {!readOnly && <th className="pb-2 font-semibold print:hidden"><span className="sr-only">Quitar</span></th>}
                </tr>
              </thead>
              <tbody>
                {inv.items.map((l) => {
                  const data = info[l.id];
                  return (
                    <tr key={l.id} className="border-t border-line align-middle">
                      <td className="py-2 pr-3 font-semibold">{l.name}</td>
                      <td className="py-2 pr-3">
                        {readOnly ? l.quantity : (
                          <QuantityField
                            label={`Cantidad de ${l.name}`}
                            value={l.quantity}
                            onCommit={(q) => send({ op: "update", id: l.id, quantity: q }, patchLine(l.id, { quantity: q }))}
                          />
                        )}
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
                        {data?.equippable && readOnly ? (
                          <span className={l.equipped ? "" : "text-muted"}>{l.equipped ? "Sí" : "—"}</span>
                        ) : data?.equippable ? (
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-brand"
                            checked={l.equipped}
                            aria-label={`Equipar ${l.name}`}
                            onChange={(e) => toggleEquipped(l.id, e.target.checked)}
                          />
                        ) : <span className="text-muted" aria-hidden="true">-</span>}
                      </td>
                      <td className="py-2 pr-3">
                        {readOnly ? <span className="text-muted">{l.notes}</span> : (
                          <NotesField
                            label={`Notas de ${l.name}`}
                            value={l.notes}
                            onCommit={(notes) => send({ op: "update", id: l.id, notes }, patchLine(l.id, { notes }))}
                          />
                        )}
                      </td>
                      {!readOnly && (
                        <td className="py-2 text-right print:hidden">
                          <button
                            type="button"
                            aria-label={`Quitar ${l.name}`}
                            onClick={() => send({ op: "remove", id: l.id }, (i) => ({ ...i, items: i.items.filter((x) => x.id !== l.id) }))}
                            className="rounded-md p-1.5 text-muted transition-colors hover:text-brand-soft"
                          >
                            <X size={16} aria-hidden="true" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className={`mt-4 text-sm ${over ? "font-semibold text-brand-soft" : "text-muted"}`}>
          Peso: {weightText(totalWeight)} de {weightText(capacity)}
          {over && (
            <span className="ml-2 inline-flex items-center gap-1" role="status">
              <TriangleAlert size={14} aria-hidden="true" /> Supera la capacidad de carga
            </span>
          )}
        </p>
      </section>

      <section className={`${card} animate-fade-up`} aria-labelledby="coins-title">
        <h3 id="coins-title" className={cardTitle}>Monedas</h3>
        <CoinsEditor coins={inv.coins} readOnly={readOnly} onCommit={(coins) => send({ op: "coins", coins }, (i) => ({ ...i, coins }))} />
        <p className="mt-3 text-sm text-muted">Total: {fmt(goldValue(inv.coins))} po</p>
      </section>

      <section className={`${card} animate-fade-up`} aria-labelledby="other-title">
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
