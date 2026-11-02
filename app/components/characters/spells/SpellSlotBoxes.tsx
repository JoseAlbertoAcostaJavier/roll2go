"use client";

// Casillas de los espacios de un nivel (las de la tabla y las de la vista de gestión): rellenas las libres, huecas las
// gastadas. Pulsar una libre gasta hasta ella; una gastada, la recupera (y las siguientes). Sin `onSet`, solo lectura.
export default function SpellSlotBoxes({ level, count, used, onSet, busy, pact = false, spellLevel, size = "sm", tag = false, className = "" }: {
  /** "1".."9" o "pact": lo que recibe `onSet`. */
  level: string;
  count: number;
  used: number;
  /** null = solo lectura. */
  onSet: ((level: string, used: number) => void) | null;
  busy: boolean;
  /** Son los espacios de Magia de pacto (cambia el nombre accesible). */
  pact?: boolean;
  /** Nivel de los espacios (para el nombre accesible). */
  spellLevel: number;
  size?: "sm" | "md";
  /** Muestra la etiqueta «Pacto» antes de las casillas. */
  tag?: boolean;
  className?: string;
}) {
  const spent = Math.min(used, count);
  const kind = `${pact ? "pacto de " : ""}nivel ${spellLevel}`;
  const side = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span
      role={onSet ? "group" : undefined}
      aria-label={onSet ? `Espacios de ${kind}` : undefined}
      className={`inline-flex items-center gap-1.5 ${className}`}
    >
      {tag && <span className="text-xs font-semibold uppercase tracking-wide text-muted">Pacto</span>}
      {Array.from({ length: count }, (_, i) => {
        const isSpent = i < spent;
        const dot = `block ${side} shrink-0 rounded-full border-2 transition-colors ${
          isSpent ? "border-muted bg-transparent" : "border-brand bg-brand"
        }`;
        if (!onSet) return <span key={i} className={dot} aria-hidden="true" />;
        return (
          <button
            key={i}
            type="button"
            disabled={busy}
            aria-label={`Espacio de ${kind}, ${isSpent ? "gastado" : "libre"} (${i + 1} de ${count})`}
            title={isSpent ? "Recuperar" : "Gastar"}
            onClick={() => onSet(level, isSpent ? i : i + 1)}
            className={`${dot} enabled:hover:scale-110 disabled:opacity-60`}
          />
        );
      })}
      <span className="ml-1 text-xs font-normal normal-case tracking-normal text-muted">
        {count - spent}/{count}
        {!onSet && <span className="sr-only"> espacios de {kind} disponibles</span>}
      </span>
    </span>
  );
}
