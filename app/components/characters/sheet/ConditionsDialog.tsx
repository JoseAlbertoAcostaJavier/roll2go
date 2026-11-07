"use client";

import { useEffect, useId, useRef } from "react";
import { Skull, Trash2, X } from "lucide-react";
import { useState } from "react";
import { CUSTOM_LIMITS } from "@/lib/rules/dnd2024/sheet/custom";
import type { CustomCondition } from "@/lib/rules/dnd2024/sheet/sheet";
import { field } from "@/app/components/ui/formStyles";
import MaskIcon from "@/app/components/ui/MaskIcon";
import { CONDITION_NAMES } from "@/lib/rules/dnd2024/sheet/labels";
import { exhaustionEffect } from "@/lib/rules/dnd2024/sheet/conditions";
import { CONDITION_KEYS } from "@/lib/rules/dnd2024/sheet/status";
import { iconSrc } from "@/lib/utils/icons";

// Gestión de estados del dueño: una casilla por estado y el nivel de agotamiento (0–6). Cada cambio se guarda al
// momento (lo hace quien lo abre). Mismo comportamiento que StatDialog: foco atrapado, Escape cierra y el foco vuelve
// a «Gestionar estados».
export default function ConditionsDialog({ conditions, exhaustion, onCondition, onExhaustion, error, busy, onClose, opener, customConditions, onCreate, onCustomActive, onCustomDelete }: {
  conditions: string[];
  exhaustion: number;
  onCondition: (key: string, active: boolean) => void;
  onExhaustion: (level: number) => void;
  error: string;
  /** Guardando: los controles quedan en `aria-disabled` (sin perder el foco) y no aceptan cambios. */
  busy: boolean;
  onClose: () => void;
  /** Botón que abrió el diálogo; recibe el foco al cerrar. */
  opener: HTMLElement | null;
  /** Estados creados por el jugador. */
  customConditions: CustomCondition[];
  /** Crea uno; devuelve el mensaje de error, si lo hay. */
  onCreate: (name: string, description: string) => Promise<string | null>;
  onCustomActive: (id: string, active: boolean) => void;
  onCustomDelete: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const message = await onCreate(name, description);
    setSaving(false);
    if (message) return;
    setName("");
    setDescription("");
    setCreating(false);
  }
  const uid = useId();
  const box = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [opener]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab" && box.current) {
      const items = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")];
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

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm print:hidden"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={box}
        aria-busy={busy}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="max-h-full w-full max-w-lg animate-pop overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] outline-none sm:p-6"
      >
        <div className="mb-4 flex items-start gap-3">
          <h3 id={`${uid}-title`} className="min-w-0 flex-1 font-heading text-2xl font-bold">Gestionar estados</h3>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface hover:text-white"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {CONDITION_KEYS.map((k) => (
            <li key={k}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface">
                <input
                  type="checkbox"
                  checked={conditions.includes(k)}
                  aria-disabled={busy}
                  onChange={(e) => !busy && onCondition(k, e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-brand"
                />
                <MaskIcon src={iconSrc("condition", k)} size={18} className="text-muted" />
                <span className="text-sm">{CONDITION_NAMES[k] ?? k}</span>
              </label>
            </li>
          ))}
        </ul>

        {/* Estados propios */}
        <div className="mt-4 border-t border-line pt-4">
          <h4 className="mb-2 text-sm font-semibold">Estados propios</h4>
          {customConditions.length > 0 && (
            <ul className="mb-2 space-y-1">
              {customConditions.map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={c.active} onChange={(e) => onCustomActive(c.id, e.target.checked)} className="h-4 w-4 shrink-0 accent-brand" />
                    <span className="truncate">{c.name}</span>
                  </label>
                  <button type="button" aria-label={`Borrar ${c.name}`} title="Borrar" onClick={() => onCustomDelete(c.id)} className="shrink-0 text-muted transition-colors hover:text-danger">
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {creating ? (
            <form onSubmit={create} className="space-y-2">
              <label className="block text-xs font-semibold text-muted">Nombre
                <input autoFocus required maxLength={CUSTOM_LIMITS.name} value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1 py-1.5! text-sm`} />
              </label>
              <label className="block text-xs font-semibold text-muted">Descripción
                <textarea rows={3} maxLength={CUSTOM_LIMITS.text} value={description} onChange={(e) => setDescription(e.target.value)} className={`${field} mt-1 py-1.5! text-sm`} />
              </label>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setCreating(false)} className="text-sm font-semibold text-muted hover:text-white">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-md bg-brand px-3 py-1.5 text-sm font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50">Guardar</button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setCreating(true)} className="rounded-md border border-line-strong px-3 py-1.5 text-sm font-semibold text-fg transition-colors hover:border-fg">
              + Nuevo estado
            </button>
          )}
        </div>

        {/* Agotamiento: pulsar un nivel lo fija; pulsar el actual lo baja uno */}
        <div className="mt-4 border-t border-line pt-4">
          <h4 id={`${uid}-exh`} className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <MaskIcon src={iconSrc("condition", "exhaustion")} size={18} className="text-muted" />
            Nivel de agotamiento
          </h4>
          <ol aria-labelledby={`${uid}-exh`} className="relative flex justify-between">
            <span aria-hidden="true" className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 bg-line" />
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <li key={n} className="relative">
                <button
                  type="button"
                  aria-pressed={exhaustion >= n}
                  aria-label={`Agotamiento ${n}`}
                  onClick={() => !busy && onExhaustion(exhaustion === n ? n - 1 : n)}
                  className={`flex size-9 items-center justify-center rounded-full font-heading text-sm font-bold transition-colors ${exhaustion >= n ? "bg-brand text-white" : "bg-line text-fg hover:bg-line-strong"}`}
                >
                  {n === 6 ? <Skull size={18} aria-hidden="true" /> : n}
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-muted">{exhaustion === 0 ? "Sin agotamiento." : exhaustionEffect(exhaustion)}</p>
        </div>

        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
