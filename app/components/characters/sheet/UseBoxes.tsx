"use client";

import { Check, Minus, Plus } from "lucide-react";

const MAX_BOXES = 10;

// Cuadrados de uso (espacios de conjuro y usos de rasgos), como en D&D Beyond: hueco = disponible, marcado (fondo de
// marca con ✓) = gastado. Pulsar un hueco gasta hasta él; pulsar uno marcado lo recupera (y los siguientes). Con más
// de 10, «n / máx» con − y +. Sin `onSet`, solo lectura.
export default function UseBoxes({ count, used, onSet, busy, label, itemLabel, size = "sm", tag, className = "", diamond = false }: {
  count: number;
  used: number;
  /** null = solo lectura. Recibe los usos gastados que quedan. */
  onSet: ((used: number) => void) | null;
  busy: boolean;
  /** Nombre del conjunto («Espacios de nivel 1», «Furia»). */
  label: string;
  /** Nombre de cada cuadrado («Espacio de nivel 1»); por defecto, `label`. */
  itemLabel?: string;
  size?: "sm" | "md";
  /** Etiqueta antes de los cuadrados («Pacto»). */
  tag?: string;
  className?: string;
  /** Rombos en vez de cuadrados (espacios de conjuro). */
  diamond?: boolean;
}) {
  const spent = Math.max(0, Math.min(used, count));
  const free = count - spent;
  const each = itemLabel ?? label;
  const side = size === "md" ? "h-5 w-5" : "h-4 w-4";
  const iconSize = size === "md" ? 14 : 12;
  const small = "ml-1 text-xs font-normal normal-case tracking-normal text-muted";

  if (count > MAX_BOXES) {
    const btn = "flex h-6 w-6 items-center justify-center rounded-sm border-2 border-brand text-brand-soft enabled:hover:bg-brand/20 disabled:opacity-60";
    return (
      <span role={onSet ? "group" : undefined} aria-label={onSet ? label : undefined} className={`inline-flex items-center gap-1.5 ${className}`}>
        {tag && <span className="text-xs font-semibold uppercase tracking-wide text-muted">{tag}</span>}
        {onSet && (
          <button type="button" disabled={busy || free <= 0} aria-label={`Gastar un uso de ${each}`} title="Gastar" onClick={() => onSet(spent + 1)} className={btn}>
            <Minus size={14} aria-hidden="true" />
          </button>
        )}
        <span className="min-w-12 text-center text-sm font-semibold tabular-nums">
          <span aria-hidden="true">{free} / {count}</span>
          <span className="sr-only">{label}: {free} de {count} disponibles</span>
        </span>
        {onSet && (
          <button type="button" disabled={busy || spent <= 0} aria-label={`Recuperar un uso de ${each}`} title="Recuperar" onClick={() => onSet(spent - 1)} className={btn}>
            <Plus size={14} aria-hidden="true" />
          </button>
        )}
      </span>
    );
  }

  return (
    <span role={onSet ? "group" : undefined} aria-label={onSet ? label : undefined} className={`inline-flex items-center gap-2 ${className}`}>
      {tag && <span className="text-xs font-semibold uppercase tracking-wide text-muted">{tag}</span>}
      {Array.from({ length: count }, (_, i) => {
        const isSpent = i < spent;
        const box = `flex ${side} shrink-0 items-center justify-center rounded-sm border-2 text-white transition-colors ${diamond ? "rotate-45" : ""} ${
          // Al imprimir sin fondos, la marca sale en negro para que se distinga de los libres
          isSpent ? "border-brand bg-brand print:text-black" : "border-brand/60 bg-transparent"
        }`;
        const mark = isSpent ? <Check size={iconSize} strokeWidth={3} aria-hidden="true" className={diamond ? "-rotate-45" : ""} /> : null;
        if (!onSet) return <span key={i} className={box} aria-hidden="true">{mark}</span>;
        return (
          <button
            key={i}
            type="button"
            disabled={busy}
            aria-label={`${each}, ${isSpent ? "gastado" : "libre"} (${i + 1} de ${count})`}
            title={isSpent ? "Recuperar" : "Gastar"}
            onClick={() => onSet(isSpent ? i : i + 1)}
            className={`${box} relative after:absolute after:left-1/2 after:top-1/2 after:h-8 after:w-6 after:-translate-x-1/2 after:-translate-y-1/2 enabled:hover:scale-110 disabled:opacity-60`}
          >
            {mark}
          </button>
        );
      })}
      <span className={small}>
        {free}/{count}
        {!onSet && <span className="sr-only"> {label} disponibles</span>}
      </span>
    </span>
  );
}
