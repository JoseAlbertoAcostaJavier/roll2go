"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import type { EntryOption } from "@/lib/rules/catalog";
import type { Ref } from "@/lib/rules/types";
import { MAX_ITEM_NAME, MAX_QUANTITY } from "@/lib/rules/dnd2024/edits";
import { field, labelClass, primaryButton } from "@/app/components/formStyles";
import RuleSelect from "../RuleSelect";

export type NewItem = { ref?: Ref; name?: string; quantity: number };

type Props = {
  systemId: string;
  campaignId: string | null;
  books: string[];
  /** Devuelve un mensaje de error o null si se añadió. */
  onAdd: (item: NewItem) => Promise<string | null>;
};

// Diálogo «Añadir»: objeto del catálogo (búsqueda en remoto) o personalizado
export default function AddItemDialog({ systemId, campaignId, books, onAdd }: Props) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [ref, setRef] = useState<Ref | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const loadOptions = useCallback(async (q: string): Promise<EntryOption[]> => {
    const params = new URLSearchParams({ kind: "item", system: systemId, q });
    if (campaignId) params.set("campaign", campaignId);
    else if (books.length) params.set("books", books.join(","));
    const res = await fetch(`/api/rules/entries?${params.toString()}`);
    if (!res.ok) throw new Error("No se pudo buscar.");
    return (await res.json()).entries as EntryOption[];
  }, [systemId, campaignId, books]);

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
    setOpen(false);
    reset();
  }

  const tab = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${active ? "bg-brand text-white" : "border border-line text-muted hover:text-white"}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 font-heading text-sm font-bold text-white transition-colors hover:bg-brand-hover"
      >
        <Plus size={16} aria-hidden="true" /> Añadir
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
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
                    autoFocus
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
                onClick={() => { setOpen(false); reset(); }}
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
