"use client";

import UseBoxes from "@/app/components/characters/sheet/UseBoxes";

// Cuadrados de los espacios de un nivel (los de la tabla y los de la vista de gestión): huecos los libres, marcados los
// gastados. Pulsar uno libre gasta hasta él; uno gastado, lo recupera (y los siguientes). Sin `onSet`, solo lectura.
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
  const kind = `${pact ? "pacto de " : ""}nivel ${spellLevel}`;
  return (
    <UseBoxes
      diamond count={count} used={used} busy={busy} size={size} className={className} tag={tag ? "Pacto" : undefined}
      label={`Espacios de ${kind}`} itemLabel={`Espacio de ${kind}`}
      onSet={onSet ? (n) => onSet(level, n) : null}
    />
  );
}
