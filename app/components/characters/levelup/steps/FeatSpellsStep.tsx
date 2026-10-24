"use client";

import { useMemo } from "react";
import type { SpellOption } from "@/lib/rules/catalog";
import { fitsFeatSpell } from "@/lib/rules/dnd2024/featSpells";
import { ABILITY_NAMES } from "@/lib/rules/dnd2024/labels";
import type { PendingChoice } from "@/lib/rules/dnd2024/levels";
import type { SpellPick } from "@/lib/rules/dnd2024/spellPicks";
import type { Ability } from "@/lib/rules/types";
import { field, labelClass } from "@/app/components/formStyles";
import SpellsStep from "./SpellsStep";

type Props = {
  id: string;
  /** Elección `featSpells` (con `spells` y `featSpells`). */
  p: PendingChoice;
  spells: SpellOption[];
  /** Conjuros que ya tiene por otras vías (`libro:clave`). */
  granted?: string[];
  value: SpellPick;
  onChange: (value: SpellPick) => void;
  ability: Ability | "";
  onAbility: (ability: Ability) => void;
  characterId: string | null;
  campaignId: string | null;
};

const NO_SPELLS = { cantrips: [], spells: [] };

/* Conjuros de una dote (Iniciado en la magia, Tocado por los feéricos…) al crear el personaje o al subir de nivel: la
   característica de lanzamiento, si la dote la deja elegir, y los conjuros que cumplen su filtro en modo selección. */
export default function FeatSpellsStep({ id, p, ability, onAbility, ...rest }: Props) {
  const fs = p.featSpells;
  const accepts = useMemo(() => ({
    test: (s: SpellOption) => fitsFeatSpell(s.data, s.data.level === 0 ? fs?.cantrip : fs?.spell),
    title: "Conjuros que puedes elegir",
  }), [fs]);
  if (!fs || !p.spells) return null;
  return (
    <div className="min-w-0 space-y-4">
      {fs.abilities && (
        <div className="max-w-xs">
          <label htmlFor={`${id}-ability`} className={labelClass}>Característica de lanzamiento</label>
          <select
            id={`${id}-ability`}
            className={field}
            value={ability}
            onChange={(e) => onAbility(e.target.value as Ability)}
          >
            <option value="" disabled>Elige una</option>
            {fs.abilities.map((a) => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
          </select>
        </div>
      )}
      <SpellsStep
        id={id}
        casterName={p.label}
        mode="levelUp"
        listId=""
        accepts={accepts}
        maxLevel={p.spells.maxLevel}
        pending={p}
        held={NO_SPELLS}
        {...rest}
      />
    </div>
  );
}
