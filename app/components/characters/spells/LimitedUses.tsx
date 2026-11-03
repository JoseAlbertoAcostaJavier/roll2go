"use client";

import UseBoxes from "@/app/components/characters/sheet/UseBoxes";
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

// Cuadrados de usos de un conjuro, como los de los espacios: hueco = disponible, marcado = gastado. Pulsar uno
// disponible lo gasta; uno gastado, lo recupera
export function Uses({ item, onSet, busy }: { item: Limited; onSet: Props["onSet"]; busy: boolean }) {
  const name = item.spell.name || bareName(item.spell.ref.key);
  return (
    <UseBoxes
      count={item.max} used={item.used} busy={busy} label={`Usos de ${name}`} itemLabel={`Uso de ${name}`}
      onSet={onSet ? (n) => onSet(item.key, n) : null}
    />
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
