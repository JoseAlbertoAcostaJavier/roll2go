"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import MaskIcon from "@/app/components/ui/MaskIcon";
import { CONDITION_NAMES } from "@/lib/rules/dnd2024/sheet/labels";
import { exhaustionEffect } from "@/lib/rules/dnd2024/sheet/conditions";
import { CONDITION_KEYS } from "@/lib/rules/dnd2024/sheet/status";
import { iconSrc } from "@/lib/utils/icons";

// Gestión de estados del dueño: una casilla por estado y el nivel de agotamiento (0–6). Cada cambio se guarda al
// momento (lo hace quien lo abre). Mismo comportamiento que StatDialog: foco atrapado, Escape cierra y el foco vuelve
// a «Gestionar estados».
export default function ConditionsDialog({ conditions, exhaustion, onCondition, onExhaustion, error, onClose, opener }: {
  conditions: string[];
  exhaustion: number;
  onCondition: (key: string, active: boolean) => void;
  onExhaustion: (level: number) => void;
  error: string;
  onClose: () => void;
  /** Botón que abrió el diálogo; recibe el foco al cerrar. */
  opener: HTMLElement | null;
}) {
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
      const items = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled)")];
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
                  onChange={(e) => onCondition(k, e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-brand"
                />
                <MaskIcon src={iconSrc("condition", k)} size={18} className="text-muted" />
                <span className="text-sm">{CONDITION_NAMES[k] ?? k}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-line pt-4">
          <label htmlFor={`${uid}-exh`} className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
            <MaskIcon src={iconSrc("condition", "exhaustion")} size={18} className="text-muted" />
            Agotamiento
          </label>
          <select
            id={`${uid}-exh`}
            value={exhaustion}
            onChange={(e) => onExhaustion(Number(e.target.value))}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-fg focus:border-brand focus:outline-none"
          >
            {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <p className="mt-2 text-sm text-muted">{exhaustion === 0 ? "Sin agotamiento." : exhaustionEffect(exhaustion)}</p>
        </div>

        {error && <p role="alert" className="mt-3 text-sm text-brand-soft">{error}</p>}
      </div>
    </div>
  );
}
