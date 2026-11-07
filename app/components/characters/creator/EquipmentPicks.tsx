"use client";

import { PackageOpen } from "lucide-react";
import type { EntryOption } from "@/lib/rules/catalog/types";
import { choosePacks } from "@/lib/rules/dnd2024/creation/creatorPicks";
import { choiceMatches } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { Equipment, ItemData, Ref } from "@/lib/rules/types";
import RuleSelect from "./RuleSelect";

/* Un desplegable por cada objeto a elegir ("Un juego (a elegir)"…) de la opción de equipo elegida. `items` son los
   objetos no mágicos del catálogo, con `data`, que se filtran por lo que pide cada paquete. */
export default function EquipmentPicks({
  idPrefix, equipment, letter, picks, onChange, items,
}: {
  idPrefix: string;
  equipment: Equipment | undefined;
  letter: string;
  picks: Record<string, Ref>;
  onChange: (picks: Record<string, Ref>) => void;
  items: EntryOption[];
}) {
  const chosen = choosePacks(equipment, letter);
  if (chosen.length === 0) return null;
  return (
    <div className="mt-4 animate-fade-in rounded-xl border border-line bg-surface/40 p-4">
      <h4 className="mb-3 flex items-center gap-2 border-b border-line pb-2.5 text-xs font-bold uppercase tracking-wider text-white">
        <PackageOpen size={16} className="text-brand-soft" aria-hidden="true" /> Personaliza tu equipo
      </h4>
      <div className="space-y-3">
      {chosen.map(({ index, pack }) => (
        <RuleSelect
          key={index}
          id={`${idPrefix}-${index}`}
          label={pack.choose!.label}
          options={items.filter((o) => {
            const data = o.data as ItemData | null;
            return !!data && !data.rarity && pack.choose!.kinds.some((k) => choiceMatches(k, data));
          })}
          value={picks[index] ?? null}
          onChange={(ref) => {
            const next = { ...picks };
            if (ref) next[index] = ref;
            else delete next[index];
            onChange(next);
          }}
        />
      ))}
      </div>
    </div>
  );
}
