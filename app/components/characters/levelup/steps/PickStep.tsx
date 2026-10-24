"use client";

import type { EntryOption } from "@/lib/rules/catalog";
import { refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import type { PendingChoice } from "@/lib/rules/dnd2024/levels";
import type { Named } from "@/lib/rules/dnd2024/sheet";
import type { Ability } from "@/lib/rules/types";
import { labelClass } from "@/app/components/formStyles";
import { ChoiceField, type ChoiceCtx } from "../../ClassFeaturesSection";
import { FeatAbilityField } from "./AsiStep";

// Singular y plural de lo que se elige
const KIND: Partial<Record<PendingChoice["type"], [string, string]>> = {
  feat: ["dote", "dotes"], optionalFeature: ["opción", "opciones"], featureOption: ["opción", "opciones"],
};

/* Dotes de progresión (estilo de combate, don épico), rasgos opcionales (metamagia, invocaciones…) y opciones de
   rasgo (Orden divina…). Si la elección lo permite, además puede sustituir una de las que ya tiene. */
export default function PickStep({
  p, ctx, slots, onChange, held, replaced, onReplace, featAbility, onFeatAbility, scores,
}: {
  p: PendingChoice;
  ctx: ChoiceCtx;
  /** Desplegables (uno más si sustituye). */
  slots: number;
  onChange: (value: string[]) => void;
  /** Las que conserva de esta misma elección (se pueden sustituir). */
  held: Named[];
  replaced: string;
  onReplace: (key: string) => void;
  featAbility: (key: string) => Ability | undefined;
  onFeatAbility: (key: string, a: Ability) => void;
  scores: Record<Ability, number>;
}) {
  const [kind, kinds] = KIND[p.type] ?? ["opción", "opciones"];
  const canReplace = !!p.optionalReplace && held.length > 0;
  const featOf = (k: string): EntryOption | undefined => ctx.feats.find((f) => refKey(f.ref) === k);
  const intro = p.count > 0
    ? `Elige ${p.count} ${p.count === 1 ? kind : kinds}.`
    : `Este nivel no da ninguna ${kind} nueva, pero puedes sustituir una de las que tienes.`;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{intro}</p>
      {canReplace && (
        <div>
          <label htmlFor={`replace-${p.source}`} className={labelClass}>
            Sustituir <span className="font-normal text-muted">· opcional</span>
          </label>
          <select
            id={`replace-${p.source}`}
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-fg focus:border-brand focus:outline-none"
            value={replaced}
            onChange={(e) => onReplace(e.target.value)}
          >
            <option value="">No sustituir</option>
            {held.map((h) => <option key={refKey(h.ref)} value={refKey(h.ref)}>{h.name}</option>)}
          </select>
          {replaced && <p className="mt-1 text-xs text-muted">Elige abajo la {kind} que la sustituye.</p>}
        </div>
      )}
      {slots > 0 && (
        <ChoiceField p={p} ctx={ctx} count={slots} onChange={onChange}>
          {(k) => p.type === "feat" && (
            <FeatAbilityField
              id={`feat-ability-${k.replace(/[^a-z0-9]+/gi, "-")}`}
              feat={featOf(k)}
              value={featAbility(k)}
              scores={scores}
              onChange={(a) => onFeatAbility(k, a)}
            />
          )}
        </ChoiceField>
      )}
    </div>
  );
}
