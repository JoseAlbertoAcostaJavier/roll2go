"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import type { EntryOption } from "@/lib/rules/catalog/types";
import type { Ref } from "@/lib/rules/types";
import { MAX_ITEM_NAME, MAX_QUANTITY } from "@/lib/rules/dnd2024/sheet/edits";
import { field, labelClass, primaryButton } from "@/app/components/ui/formStyles";
import RuleSelect from "../creator/RuleSelect";

export type NewItem = { ref?: Ref; name?: string; quantity: number };

type Props = {
  systemId: string;
  /** Libros que puede usar el personaje, ya calculados (sirven aunque el dueño haya dejado la campaña). */
  books: string[];
  /** Devuelve un mensaje de error o null si se añadió. */
  onAdd: (item: NewItem) => Promise<string | null>;
};

// Diálogo «Añadir»: objeto del catálogo (búsqueda en remoto) o personalizado
export default function AddItemDialog({ systemId, books, onAdd }: Props) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [ref, setRef] = useState<Ref | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const trigger = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);

  // Foco dentro del diálogo al abrir (en el campo de búsqueda o de nombre)
  useEffect(() => {
    if (open) form.current?.querySelector<HTMLElement>("input")?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    reset();
    trigger.current?.focus();
  }

  // Escape cierra el diálogo (salvo que ya lo haya gastado la lista abierta) y Tab no sale de él
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.defaultPrevented) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab" && form.current) {
      const items = [...form.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")];
      const [first, last] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  async function loadOptions(q: string): Promise<EntryOption[]> {
    const params = new URLSearchParams({ kind: "item", system: systemId, q });
    if (books.length) params.set("books", books.join(","));
    const res = await fetch(`/api/rules/entries?${params.toString()}`);
    if (!res.ok) throw new Error("No se pudo buscar.");
    return (await res.json()).entries as EntryOption[];
  }

  function reset() {
    setCustom(false);
    setRef(null);
    setName("");
    setQuantity("1");
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QUANTITY) return setError(`La cantidad va de 0 a ${MAX_QUANTITY}.`);
    if (custom && !name.trim()) return setError("Escribe un nombre.");
    if (!custom && !ref) return setError("Elige un objeto.");
    setBusy(true);
    setError("");
    const message = await onAdd(custom ? { name: name.trim(), quantity: qty } : { ref: ref!, quantity: qty });
    setBusy(false);
    if (message) return setError(message);
    close();
  }

  const tab = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${active ? "bg-brand text-white" : "border border-line text-muted hover:text-white"}`;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 font-heading text-sm font-bold text-white transition-colors hover:bg-brand-hover"
      >
        <Plus size={16} aria-hidden="true" /> Añadir
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            ref={form}
            onKeyDown={onKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${uid}-title`}
            onSubmit={submit}
            className="max-h-full w-full max-w-md animate-pop overflow-y-auto rounded-xl border border-line bg-panel p-6 shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
          >
            <h3 id={`${uid}-title`} className="mb-4 font-heading text-xl font-bold">Añadir objeto</h3>

            <div className="mb-4 flex gap-2">
              <button type="button" className={tab(!custom)} aria-pressed={!custom} onClick={() => setCustom(false)}>Del catálogo</button>
              <button type="button" className={tab(custom)} aria-pressed={custom} onClick={() => setCustom(true)}>Personalizado</button>
            </div>

            <div className="mb-4">
              {custom ? (
                <>
                  <label htmlFor={`${uid}-name`} className={labelClass}>Nombre</label>
                  <input
                    id={`${uid}-name`}
                    className={field}
                    maxLength={MAX_ITEM_NAME}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </>
              ) : (
                <RuleSelect
                  id={`${uid}-item`}
                  label="Objeto"
                  options={[]}
                  loadOptions={loadOptions}
                  value={ref}
                  onChange={setRef}
                  placeholder="Busca un objeto"
                />
              )}
            </div>

            <div className="mb-4 w-28">
              <label htmlFor={`${uid}-qty`} className={labelClass}>Cantidad</label>
              <input
                id={`${uid}-qty`}
                type="number"
                min={0}
                max={MAX_QUANTITY}
                className={field}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            {error && <p role="alert" className="mb-3 text-sm text-brand-soft">{error}</p>}

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={close}
                className="rounded-md border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-white"
              >
                Cancelar
              </button>
              <button type="submit" disabled={busy} className={primaryButton}>
                {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />} Añadir
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
