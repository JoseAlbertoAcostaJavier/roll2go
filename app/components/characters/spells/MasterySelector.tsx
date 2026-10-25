"use client";

import type { SpellOption } from "@/lib/rules/catalog/types";
import type { CasterBlock } from "@/lib/rules/dnd2024/derive";
import { bareName, refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import { ACTION_TIME } from "@/lib/rules/dnd2024/spellOps";
import type { Ref } from "@/lib/rules/types";
import { field, labelClass } from "@/app/components/formStyles";

type Props = {
  id: string;
  block: CasterBlock;
  spells: Map<string, SpellOption>;
  isOwner: boolean;
  busy: boolean;
  onChange: (level: 1 | 2, ref: Ref | null) => void;
};

const LEVELS = [1, 2] as const;
const nameOf = (s: SpellOption) => s.nameEs ?? s.name;

/* Dominio de conjuros (Mago 18, spec de ampliación §2.6): un conjuro de nivel 1 y otro de nivel 2 de su libro que se
   lancen con una acción; el dueño los elige y los cambia cuando quiera y quedan siempre preparados. Los demás solo ven
   los elegidos. */
export default function MasterySelector({ id, block, spells, isOwner, busy, onChange }: Props) {
  const mastery = block.mastery;
  if (!mastery) return null;
  const label = (r: Ref | null) => {
    if (!r) return "sin elegir";
    const s = spells.get(refKey(r));
    return s ? nameOf(s) : (block.spellbook.find((b) => refKey(b.ref) === refKey(r))?.name || bareName(r.key));
  };
  if (!isOwner) {
    return (
      <p className="mb-4 text-sm">
        <span className="font-semibold">Dominio de conjuros:</span> {LEVELS.map((l) => `nivel ${l}: ${label(mastery[l])}`).join(" · ")}
      </p>
    );
  }
  // Del libro, del nivel exacto y con tiempo de lanzamiento de una acción
  const options = (level: number) => block.spellbook
    .map((b) => spells.get(refKey(b.ref)))
    .filter((s): s is SpellOption => !!s && s.data.level === level && s.data.time === ACTION_TIME)
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b), "es"));
  return (
    <fieldset className="mb-4 print:hidden">
      <legend className={labelClass}>Dominio de conjuros</legend>
      <p className="mb-2 text-xs text-muted">Los lanzas a su nivel más bajo sin gastar espacio; quedan siempre preparados.</p>
      <div className="flex flex-wrap gap-3">
        {LEVELS.map((level) => (
          <div key={level} className="w-full max-w-xs">
            <label htmlFor={`${id}-${level}`} className="mb-1 block text-xs font-semibold text-muted">Nivel {level}</label>
            <select
              id={`${id}-${level}`}
              className={field}
              value={mastery[level] ? refKey(mastery[level]!) : ""}
              disabled={busy}
              onChange={(e) => {
                const s = spells.get(e.target.value);
                onChange(level, s ? s.ref : null);
              }}
            >
              <option value="">Sin elegir</option>
              {options(level).map((s) => <option key={refKey(s.ref)} value={refKey(s.ref)}>{nameOf(s)}</option>)}
            </select>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
