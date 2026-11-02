"use client";

import type { SpellOption } from "@/lib/rules/catalog/types";
import type { CasterBlock } from "@/lib/rules/dnd2024/derive";
import { bareName, refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import SpellList, { type SpellOpener, type SpellRowItem } from "./SpellList";

type Limited = CasterBlock["limited"][number];

type Props = {
  /** Conjuros con usos por descanso, de un mismo origen (Arcano místico o Conjuros distintivos). */
  title: string;
  /** Con qué descanso se recuperan. */
  hint: string;
  items: Limited[];
  spells: Map<string, SpellOption>;
  /** null = solo lectura. */
  onSet: ((key: string, used: number) => void) | null;
  busy: boolean;
  onOpen: SpellOpener;
};

// Casillas de usos de un conjuro, como las de los espacios: rellenas las disponibles, huecas las gastadas. Pulsar una
// disponible la gasta; una gastada, la recupera
export function Uses({ item, onSet, busy }: { item: Limited; onSet: Props["onSet"]; busy: boolean }) {
  const spent = Math.min(item.used, item.max);
  const name = item.spell.name || bareName(item.spell.ref.key);
  return (
    <span className="flex items-center gap-1.5" role={onSet ? "group" : undefined} aria-label={onSet ? `Usos de ${name}` : undefined}>
      {Array.from({ length: item.max }, (_, i) => {
        const isSpent = i < spent;
        const dot = `block h-5 w-5 rounded-full border-2 transition-colors ${isSpent ? "border-muted bg-transparent" : "border-brand bg-brand"}`;
        if (!onSet) return <span key={i} className={dot} aria-hidden="true" />;
        return (
          <button
            key={i}
            type="button"
            disabled={busy}
            aria-pressed={isSpent}
            aria-label={`Uso ${i + 1} de ${item.max} de ${name}${isSpent ? " (gastado)" : ""}`}
            title={isSpent ? "Recuperar" : "Gastar"}
            onClick={() => onSet(item.key, isSpent ? i : i + 1)}
            className={`${dot} enabled:hover:scale-110 disabled:opacity-60`}
          />
        );
      })}
      <span className="ml-1 text-xs text-muted">
        {item.max - spent}/{item.max}
        {!onSet && <span className="sr-only"> disponibles</span>}
      </span>
    </span>
  );
}

/* Conjuros que se lanzan sin espacio una vez por descanso (Arcano místico, Conjuros distintivos), con sus casillas de
   uso (spec de ampliación §3). Solo el dueño las marca. */
export default function LimitedUses({ title, hint, items, spells, onSet, busy, onOpen }: Props) {
  const rows: SpellRowItem[] = items.map((l) => {
    const spell = spells.get(refKey(l.spell.ref)) ?? null;
    return {
      ref: l.spell.ref, name: l.spell.name || bareName(l.spell.ref.key), spell,
      action: <Uses item={l} onSet={onSet} busy={busy} />,
    };
  }).sort((a, b) => (a.spell?.data.level ?? 0) - (b.spell?.data.level ?? 0) || a.name.localeCompare(b.name, "es"));
  return (
    <div>
      <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h4>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
      <SpellList items={rows} empty="" onOpen={onOpen} />
    </div>
  );
}
