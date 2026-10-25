"use client";

import { useMemo } from "react";
import type { SpellOption } from "@/lib/rules/catalog";
import { bareName, refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import { fitsFeatSpell } from "@/lib/rules/dnd2024/featSpells";
import { ABILITY_NAMES, spellListName } from "@/lib/rules/dnd2024/labels";
import type { PendingChoice } from "@/lib/rules/dnd2024/levels";
import type { Named } from "@/lib/rules/dnd2024/sheet";
import type { SpellPick } from "@/lib/rules/dnd2024/spellPicks";
import type { Ability, FeatSpellFilter } from "@/lib/rules/types";
import { field, labelClass } from "@/app/components/formStyles";
import RuleSelect from "../../RuleSelect";
import SpellsStep from "./SpellsStep";

type Props = {
  id: string;
  /** Elección `featSpells` (con `spells` y `featSpells`). */
  p: PendingChoice;
  spells: SpellOption[];
  /** Conjuros que ya tiene por otras vías (`libro:clave`). */
  granted?: string[];
  /** Los que conserva de la dote (de ahí sale el que se cambia, si la elección lo permite). */
  held?: Named[];
  value: SpellPick;
  onChange: (value: SpellPick) => void;
  ability: Ability | "";
  onAbility: (ability: Ability) => void;
  characterId: string | null;
  campaignId: string | null;
};

const NO_SPELLS = { cantrips: [], spells: [] };
const nameOf = (s: SpellOption) => s.nameEs ?? s.name;

/* Conjuros de una dote (Iniciado en la magia, Tocado por los feéricos…) o de una invocación (Pacto del tomo) al crear el
   personaje o al subir de nivel: la lista, si la dote deja elegirla (Iniciado en la magia base); la característica de
   lanzamiento, si la deja elegir; los conjuros que cumplen su filtro en modo selección y, si la elección lo permite, el
   cambio opcional de uno de los que ya tiene por otro del mismo nivel. */
export default function FeatSpellsStep({ id, p, ability, onAbility, held = [], ...rest }: Props) {
  const fs = p.featSpells;
  const { value, onChange, spells } = rest;
  const list = fs?.lists ? (fs.lists.includes(value.list ?? "") ? value.list : undefined) : undefined;
  // Los filtros de la dote, con la lista elegida
  const filters = useMemo(() => {
    const withList = (f: FeatSpellFilter | undefined) => (f && list ? { ...f, classes: [list] } : f);
    return { cantrip: withList(fs?.cantrip), spell: withList(fs?.spell) };
  }, [fs, list]);
  const accepts = useMemo(() => ({
    test: (s: SpellOption) => fitsFeatSpell(s.data, s.data.level === 0 ? filters.cantrip : filters.spell),
    title: "Conjuros que puedes elegir",
  }), [filters]);
  if (!fs || !p.spells) return null;
  const byKey = new Map(spells.map((s) => [refKey(s.ref), s]));

  // Cambio de uno de los que tiene: por otro del mismo nivel que cumpla el filtro de la dote
  const swap = value.replace;
  const outSpell = swap.out ? byKey.get(swap.out) : undefined;
  const taken = new Set([
    ...held.map((h) => refKey(h.ref)), ...(rest.granted ?? []), ...value.cantrips, ...value.spells,
  ]);
  const swapOptions = outSpell
    ? spells.filter((s) => {
      const filter = outSpell.data.level === 0 ? filters.cantrip : filters.spell;
      return !taken.has(refKey(s.ref)) && fitsFeatSpell(s.data, filter && { ...filter, level: outSpell.data.level });
    }).sort((a, b) => nameOf(a).localeCompare(nameOf(b), "es"))
    : [];
  const setSwap = (out: string, inKey: string) => onChange({ ...value, replace: { out, in: inKey } });
  // Sin la lista elegida (dote base), no se pueden elegir los conjuros
  const needsList = !!fs.lists && !list;

  return (
    <div className="min-w-0 space-y-4">
      {(fs.lists || fs.abilities) && (
        <div className="flex flex-wrap gap-4">
          {fs.lists && (
            <div className="w-full max-w-xs">
              <label htmlFor={`${id}-list`} className={labelClass}>Lista de conjuros</label>
              <select
                id={`${id}-list`}
                className={field}
                value={list ?? ""}
                // Otra lista deja sin elegir los conjuros de la anterior
                onChange={(e) => onChange({ ...value, list: e.target.value, cantrips: [], spells: [], replace: { out: "", in: "" } })}
              >
                <option value="" disabled>Elige una</option>
                {fs.lists.map((l) => <option key={l} value={l}>{spellListName(l)}</option>)}
              </select>
            </div>
          )}
          {fs.abilities && (
            <div className="w-full max-w-xs">
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
        </div>
      )}

      {p.optionalReplace && held.length > 0 && !needsList && (
        <fieldset className="space-y-3 rounded-md border border-line p-3">
          <legend className="px-1 text-sm font-semibold">
            Puedes cambiar uno de sus conjuros <span className="font-normal text-muted">· opcional</span>
          </legend>
          <div>
            <label htmlFor={`${id}-out`} className={labelClass}>Sale</label>
            <select id={`${id}-out`} className={field} value={swap.out} onChange={(e) => setSwap(e.target.value, "")}>
              <option value="">No cambiar</option>
              {held.map((h) => {
                const k = refKey(h.ref);
                const s = byKey.get(k);
                return <option key={k} value={k}>{s ? nameOf(s) : h.name || bareName(h.ref.key)}</option>;
              })}
            </select>
          </div>
          {swap.out && (
            <div className="animate-fade-in">
              <RuleSelect
                id={`${id}-in`}
                label="Entra"
                options={swapOptions}
                value={swap.in ? (byKey.get(swap.in)?.ref ?? null) : null}
                onChange={(r) => setSwap(swap.out, r ? refKey(r) : "")}
                placeholder="Busca un conjuro del mismo nivel"
              />
            </div>
          )}
        </fieldset>
      )}

      {needsList ? (
        <p className="text-sm text-muted">Elige primero la lista de la que salen sus conjuros.</p>
      ) : p.count > 0 && (
        <SpellsStep
          id={id}
          casterName={p.label}
          mode="levelUp"
          listId=""
          accepts={accepts}
          maxLevel={p.spells.maxLevel}
          // (el cambio de conjuro va arriba)
          pending={{ ...p, optionalReplace: false }}
          held={NO_SPELLS}
          {...rest}
        />
      )}
    </div>
  );
}
