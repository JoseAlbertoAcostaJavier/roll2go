"use client";

// Casillas de los espacios de un nivel, para la cabecera de su grupo en la tabla: rellenas las libres, huecas las
// gastadas. Pulsar una libre gasta hasta ella; una gastada, la recupera (y las siguientes). Sin `onSet`, solo lectura.
export default function SpellSlotBoxes({ level, count, used, onSet, busy, pact = false, spellLevel }: {
  /** "1".."9" o "pact": lo que recibe `onSet`. */
  level: string;
  count: number;
  used: number;
  /** null = solo lectura. */
  onSet: ((level: string, used: number) => void) | null;
  busy: boolean;
  /** Son los espacios de Magia de pacto (se etiquetan «Pacto»). */
  pact?: boolean;
  /** Nivel de los espacios (para el nombre accesible). */
  spellLevel: number;
}) {
  const spent = Math.min(used, count);
  return (
    <span className="inline-flex items-center gap-1.5">
      {pact && <span className="text-xs font-semibold uppercase tracking-wide text-muted">Pacto</span>}
      {Array.from({ length: count }, (_, i) => {
        const isSpent = i < spent;
        const dot = `block h-4 w-4 rounded-full border-2 transition-colors ${
          isSpent ? "border-muted bg-transparent" : "border-brand bg-brand"
        }`;
        const label = `Espacio de ${pact ? "pacto de " : ""}nivel ${spellLevel}, ${isSpent ? "gastado" : "libre"}`;
        if (!onSet) return <span key={i} role="img" aria-label={label} className={dot} />;
        return (
          <button
            key={i}
            type="button"
            disabled={busy}
            aria-pressed={isSpent}
            aria-label={label}
            title={isSpent ? "Recuperar" : "Gastar"}
            onClick={() => onSet(level, isSpent ? i : i + 1)}
            className={`${dot} enabled:hover:scale-110 disabled:opacity-60`}
          />
        );
      })}
      <span className="ml-1 text-xs font-normal normal-case tracking-normal text-muted">{count - spent}/{count}</span>
    </span>
  );
}
