"use client";

import { RotateCw, TriangleAlert } from "lucide-react";

/* Resumen de lo elegido antes de guardar el nivel, con los errores del servidor si los hubo. */
export default function ConfirmStep({ rows, errors, conflict }: {
  rows: { label: string; value: string }[];
  /** Mensajes de error del servidor (400). */
  errors: string[];
  /** El personaje cambió de nivel en otra pestaña (409). */
  conflict: string | null;
}) {
  return (
    <div className="space-y-5">
      <dl className="divide-y divide-line rounded-xl border border-line bg-surface/40">
        {rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="text-sm font-bold text-fg">{r.label}</dt>
            <dd className="text-sm text-muted">{r.value || "—"}</dd>
          </div>
        ))}
      </dl>

      {conflict && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/50 bg-brand/10 p-3 text-sm">
          <TriangleAlert size={16} aria-hidden="true" className="shrink-0 text-brand-soft" />
          <span className="flex-1">{conflict}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 rounded-md border border-line px-3 py-1.5 font-semibold hover:border-brand hover:text-white"
          >
            <RotateCw size={14} aria-hidden="true" /> Recargar
          </button>
        </div>
      )}
      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-xl border border-brand/50 bg-brand/10 p-3 text-sm text-danger">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
    </div>
  );
}
