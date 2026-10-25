"use client";

import type { PendingChoice } from "@/lib/rules/dnd2024/levels/pendingChoices";
import { ChoiceField, type ChoiceCtx } from "../../ClassFeaturesSection";

const INTRO: Partial<Record<PendingChoice["type"], string>> = {
  skills: "Ganas competencia en habilidades nuevas.",
  expertise: "Duplicas el bonificador de competencia en habilidades con las que ya eres competente.",
  weaponMastery: "Puedes usar la propiedad de maestría de más armas con las que eres competente.",
};

/* Habilidades, pericias y maestrías: una fila de desplegables, uno por elección. */
export default function ChoiceRowsStep({ p, ctx, onChange, hint }: {
  p: PendingChoice;
  ctx: ChoiceCtx;
  onChange: (value: string[]) => void;
  /** Lo que ya tiene («Ya tienes: Atletismo, Percepción.»). */
  hint?: string;
}) {
  return (
    <div className="space-y-4">
      {INTRO[p.type] && <p className="text-sm text-muted">{INTRO[p.type]}</p>}
      <ChoiceField p={p} ctx={ctx} onChange={onChange} hint={hint} />
    </div>
  );
}
