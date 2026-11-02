"use client";

import type { Slots } from "@/lib/rules/dnd2024/derive";
import { card } from "@/app/components/ui/formStyles";
import SpellSlotBoxes from "./SpellSlotBoxes";

type Props = {
  slots: Slots;
  /** Espacios gastados por nivel ("1".."9" y "pact"). */
  used: Record<string, number>;
  /** null = solo lectura. */
  onSet: ((level: string, used: number) => void) | null;
  busy: boolean;
};

// Una fila de la tarjeta: el nivel y sus casillas (las mismas que las de la tabla)
function Marks({ spellLevel, level, count, used, onSet, busy, pact = false }: {
  spellLevel: number; level: string; count: number; used: number; onSet: Props["onSet"]; busy: boolean; pact?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2">
      <span className="min-w-0 text-sm font-semibold">Nivel {spellLevel}</span>
      <SpellSlotBoxes
        level={level} spellLevel={spellLevel} count={count} used={used} onSet={onSet} busy={busy} pact={pact}
        size="md" className="ml-auto flex-wrap"
      />
    </li>
  );
}

// Tarjeta común de espacios de conjuro (una sola aunque haya varias clases) con la Magia de pacto aparte (los descansos
// están en la cabecera de la ficha)
export default function SlotsBar({ slots, used, onSet, busy }: Props) {
  const levels = Object.entries(slots.levels).filter(([, n]) => n > 0);
  if (levels.length === 0 && !slots.pact) return null;

  return (
    <section className={`${card} animate-fade-up`} aria-labelledby="slots-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 id="slots-title" className="font-heading text-xl font-bold">Espacios de conjuro</h3>
      </div>
      {levels.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {levels.map(([level, count]) => (
            <Marks key={level} spellLevel={Number(level)} level={level} count={count} used={used[level] ?? 0} onSet={onSet} busy={busy} />
          ))}
        </ul>
      )}
      {slots.pact && (
        <>
          <h4 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-muted">Magia de pacto</h4>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Marks
              spellLevel={slots.pact.level}
              pact
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
