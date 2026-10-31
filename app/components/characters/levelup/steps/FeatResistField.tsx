"use client";

import { DAMAGE_TYPE_NAMES } from "@/lib/rules/dnd2024/sheet/labels";
import { labelClass } from "@/app/components/ui/formStyles";

/** Desplegables de los tipos de daño que resiste una dote (Don de resistencia a la energía…), sin repetir. */
export function FeatResistField({ id, count, from, value, onChange }: {
  id: string;
  count: number;
  from: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const set = (i: number, type: string) => {
    onChange(Array.from({ length: count }, (_, k) => (k === i ? type : value[k] ?? "")));
  };
  return (
    <div className="mt-3 space-y-2">
      <span className={labelClass}>{count === 1 ? "Tipo de daño al que resiste" : `Tipos de daño a los que resiste (${count})`}</span>
      {Array.from({ length: count }, (_, i) => (
        <select
          key={i}
          id={`${id}-${i}`}
          aria-label={`Tipo de daño ${i + 1}`}
          className="w-full rounded-md border border-line bg-panel px-3 py-2.5 text-fg focus:border-brand focus:outline-none"
          value={value[i] ?? ""}
          onChange={(e) => set(i, e.target.value)}
        >
          <option value="">Elige…</option>
          {from.map((t) => (
            <option key={t} value={t} disabled={value.some((v, k) => k !== i && v === t)}>{DAMAGE_TYPE_NAMES[t] ?? t}</option>
          ))}
        </select>
      ))}
    </div>
  );
}
