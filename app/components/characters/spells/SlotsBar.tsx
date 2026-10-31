"use client";

import { BedDouble, Coffee, LoaderCircle } from "lucide-react";
import type { Slots } from "@/lib/rules/dnd2024/derive";
import { card } from "@/app/components/ui/formStyles";

type Props = {
  slots: Slots;
  /** Espacios gastados por nivel ("1".."9" y "pact"). */
  used: Record<string, number>;
  /** null = solo lectura. */
  onSet: ((level: string, used: number) => void) | null;
  onLongRest: (() => void) | null;
  /** Descanso corto (solo si recupera algo: Magia de pacto o Conjuros distintivos); null = sin botón. */
  onShortRest: (() => void) | null;
  /** Si cada descanso recuperaría algo (espacios o usos gastados). */
  restores: { long: boolean; short: boolean };
  busy: boolean;
};

// Marcas de un nivel de espacios: rellenas las disponibles, huecas las gastadas. Pulsar una disponible gasta hasta
// ella; una gastada, la recupera (y las siguientes)
function Marks({ label, level, count, used, onSet, busy }: {
  label: string; level: string; count: number; used: number; onSet: Props["onSet"]; busy: boolean;
}) {
  const spent = Math.min(used, count);
  return (
    <li className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2">
      <span className="min-w-0 text-sm font-semibold">{label}</span>
      <span className="flex flex-wrap gap-1.5" role={onSet ? "group" : undefined} aria-label={onSet ? label : undefined}>
        {Array.from({ length: count }, (_, i) => {
          const isSpent = i < spent;
          const dot = `block h-5 w-5 rounded-full border-2 transition-colors ${
            isSpent ? "border-muted bg-transparent" : "border-brand bg-brand"
          }`;
          if (!onSet) return <span key={i} className={dot} aria-hidden="true" />;
          return (
            <button
              key={i}
              type="button"
              disabled={busy}
              aria-pressed={isSpent}
              aria-label={`Espacio ${i + 1} de ${count}${isSpent ? " (gastado)" : ""}`}
              title={isSpent ? "Recuperar" : "Gastar"}
              onClick={() => onSet(level, isSpent ? i : i + 1)}
              className={`${dot} enabled:hover:scale-110 disabled:opacity-60`}
            />
          );
        })}
      </span>
      <span className="ml-auto text-xs text-muted">
        {count - spent}/{count}
        {!onSet && <span className="sr-only"> disponibles</span>}
      </span>
    </li>
  );
}

const restButton = "flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold transition-colors enabled:hover:border-brand enabled:hover:text-white disabled:opacity-50 print:hidden";

// Tarjeta común de espacios de conjuro (una sola aunque haya varias clases) con la Magia de pacto aparte y los botones
// Descanso corto y Descanso largo
export default function SlotsBar({ slots, used, onSet, onLongRest, onShortRest, restores, busy }: Props) {
  const levels = Object.entries(slots.levels).filter(([, n]) => n > 0);
  if (levels.length === 0 && !slots.pact) return null;

  return (
    <section className={`${card} animate-fade-up`} aria-labelledby="slots-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 id="slots-title" className="font-heading text-xl font-bold">Espacios de conjuro</h3>
        {(onShortRest || onLongRest) && (
          <div className="flex flex-wrap gap-2">
            {onShortRest && (
              <button type="button" onClick={onShortRest} disabled={busy || !restores.short} className={restButton}>
                {busy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Coffee size={14} aria-hidden="true" />}
                Descanso corto
              </button>
            )}
            {onLongRest && (
              <button type="button" onClick={onLongRest} disabled={busy || !restores.long} className={restButton}>
                {busy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <BedDouble size={14} aria-hidden="true" />}
                Descanso largo
              </button>
            )}
          </div>
        )}
      </div>
      {levels.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {levels.map(([level, count]) => (
            <Marks key={level} label={`Nivel ${level}`} level={level} count={count} used={used[level] ?? 0} onSet={onSet} busy={busy} />
          ))}
        </ul>
      )}
      {slots.pact && (
        <>
          <h4 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-muted">Magia de pacto</h4>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Marks
              label={`Nivel ${slots.pact.level}`}
              level="pact"
              count={slots.pact.count}
              used={used.pact ?? 0}
              onSet={onSet}
              busy={busy}
            />
          </ul>
        </>
      )}
    </section>
  );
}
