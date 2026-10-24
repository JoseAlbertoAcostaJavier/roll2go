"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import type { Breakdown } from "@/lib/rules/dnd2024/derive";
import { metersText } from "@/lib/rules/dnd2024/labels";

const fmtMod = (m: number) => (m > 0 ? `+${m}` : m < 0 ? `−${-m}` : "+0");
const fmtFeet = (f: number) => (f < 0 ? `−${-f} pies` : `${f} pies`);

// Detalle de un valor de la pestaña Información (spec §3): qué es y de dónde sale su número. Mismo comportamiento que
// la ficha de conjuro: foco atrapado, Escape cierra y el foco vuelve al botón que lo abrió.
export default function StatDialog({ title, description, breakdown, unit, onClose, opener }: {
  title: string;
  description: string;
  breakdown: Breakdown;
  /** `feet`: velocidad en pies (el total con metros); `plain`: total sin signo (puntuación de característica, CA). */
  unit?: "feet" | "plain";
  onClose: () => void;
  /** Botón que abrió el diálogo (capturado al pulsar); recibe el foco al cerrar. */
  opener: HTMLElement | null;
}) {
  const uid = useId();
  const box = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // Foco en el botón de cerrar al abrir; al cerrar vuelve a quien lo abrió (no se usa document.activeElement: Safari
  // no enfoca los botones al pulsarlos)
  useEffect(() => {
    closeButton.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [opener]);

  // Escape cierra y Tab no sale de la ventana
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab" && box.current) {
      const items = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]")];
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

  const part = unit === "feet" ? fmtFeet : fmtMod;
  const total = unit === "feet" ? `${fmtFeet(breakdown.total)} (${metersText(breakdown.total)})`
    : unit === "plain" ? String(breakdown.total)
    : fmtMod(breakdown.total);

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
        onKeyDown={onKeyDown}
        className="max-h-full w-full max-w-lg animate-pop overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] sm:p-6"
      >
        <div className="mb-4 flex items-start gap-3">
          <h3 id={`${uid}-title`} className="min-w-0 flex-1 font-heading text-2xl font-bold">{title}</h3>
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

        {description && (
          <p className="mb-4 rounded-md border border-line bg-surface p-3 text-sm">{description}</p>
        )}

        <p className="mb-2 text-sm text-muted">Los modificadores que afectan a {title} son los siguientes:</p>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {breakdown.parts.map((p, i) => (
              <tr key={`${p.label}-${i}`}>
                <th scope="row" className="py-1.5 pr-3 text-left font-normal">{p.label}</th>
                <td className="py-1.5 text-right font-heading font-bold">{part(p.value)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-line">
              <th scope="row" className="py-1.5 pr-3 text-left font-bold">Total</th>
              <td className="py-1.5 text-right font-heading font-extrabold">{total}</td>
            </tr>
          </tbody>
        </table>

        {breakdown.notes?.map((n) => (
          <p key={n} className="mt-2 text-sm text-muted">{n}</p>
        ))}
      </div>
    </div>
  );
}
