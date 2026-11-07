"use client";

import { Minus, Plus } from "lucide-react";
import type { CatalogEntry, EntryOption } from "@/lib/rules/catalog/types";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { ABILITY_ABBR, ABILITY_NAMES, fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { ABILITIES, type Ability, type Ref } from "@/lib/rules/types";
import { labelClass } from "@/app/components/ui/formStyles";
import RuleSelect from "../../creator/RuleSelect";
import { Description, refFromKey } from "../../creator/ClassFeaturesSection";
import { ABILITY_CAP, ASI_POINTS, featAbility, featResistChoose, type AsiPick } from "../state";
import { FeatResistField } from "./FeatResistField";

const modOf = (score: number) => Math.floor((score - 10) / 2);
const stepBtn =
  "flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface transition-colors enabled:hover:border-brand disabled:opacity-30";
const tab = (active: boolean) =>
  `flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${active ? "bg-brand text-white" : "text-muted hover:text-white"}`;

/** Desplegable de la característica que mejora una dote (si puede elegir entre varias). */
export function FeatAbilityField({ id, feat, value, scores, onChange }: {
  id: string;
  feat: EntryOption | undefined;
  value: Ability | "" | undefined;
  scores: Record<Ability, number>;
  onChange: (a: Ability) => void;
}) {
  const fa = featAbility(feat, value);
  if (fa.from.length === 0) return null;
  if (fa.from.length === 1) {
    return <p className="mt-2 text-sm text-muted">Mejora {ABILITY_NAMES[fa.from[0]]} en 1 (hasta {fa.cap}).</p>;
  }
  return (
    <div className="mt-3">
      <label htmlFor={id} className={labelClass}>Característica que mejora (+1)</label>
      <select
        id={id}
        className="w-full rounded-md border border-line-strong bg-panel px-3 py-2.5 text-fg focus:border-brand focus:outline-none"
        value={fa.ability ?? ""}
        onChange={(e) => onChange(e.target.value as Ability)}
      >
        <option value="">Elige…</option>
        {fa.from.map((a) => (
          <option key={a} value={a} disabled={scores[a] + 1 > fa.cap}>
            {ABILITY_NAMES[a]} ({scores[a]} → {scores[a] + 1}){scores[a] + 1 > fa.cap ? ` — no puede pasar de ${fa.cap}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

/* Mejora de característica: +2 a una o +1 a dos (sin pasar de 20), o una dote general cuyos requisitos cumpla. */
export default function AsiStep({ value, onChange, scores, feats, entry }: {
  value: AsiPick;
  onChange: (v: AsiPick) => void;
  /** Puntuaciones actuales. */
  scores: Record<Ability, number>;
  /** Dotes generales que puede elegir. */
  feats: EntryOption[];
  /** Entradas completas (descripción de la dote). */
  entry: (r: Ref) => CatalogEntry | null | undefined;
}) {
  const used = Object.values(value.abilities).reduce((s, v) => s + (v ?? 0), 0);
  const left = ASI_POINTS - used;
  const step = (a: Ability, delta: number) => {
    const v = (value.abilities[a] ?? 0) + delta;
    const abilities = { ...value.abilities, [a]: v };
    if (v <= 0) delete abilities[a];
    onChange({ ...value, abilities });
  };
  const feat = feats.find((f) => refKey(f.ref) === value.feat);
  const choose = featResistChoose(feat);

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Tipo de mejora" className="flex gap-1 rounded-md border border-line bg-surface p-1">
        <button type="button" role="tab" aria-selected={value.mode === "abilities"} className={tab(value.mode === "abilities")} onClick={() => onChange({ ...value, mode: "abilities" })}>
          Mejorar características
        </button>
        <button type="button" role="tab" aria-selected={value.mode === "feat"} className={tab(value.mode === "feat")} onClick={() => onChange({ ...value, mode: "feat" })}>
          Dote
        </button>
      </div>

      {value.mode === "abilities" ? (
        <div className="animate-fade-in" key="abilities">
          <p className="mb-3 text-sm text-muted">
            +2 a una característica o +1 a dos, sin pasar de {ABILITY_CAP}.{" "}
            <span className="font-semibold text-fg">{left} {left === 1 ? "punto" : "puntos"} por repartir.</span>
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ABILITIES.map((a) => {
              const bonus = value.abilities[a] ?? 0;
              const total = scores[a] + bonus;
              return (
                <li key={a} className={`rounded-md border p-3 transition-colors ${bonus ? "border-brand bg-brand/10" : "border-line bg-surface"}`}>
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{ABILITY_NAMES[a]}</span>
                    <span className="text-xs font-bold text-muted">{ABILITY_ABBR[a]}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button type="button" className={stepBtn} aria-label={`Quitar mejora de ${ABILITY_NAMES[a]}`} disabled={bonus <= 0} onClick={() => step(a, -1)}>
                      <Minus size={14} aria-hidden="true" />
                    </button>
                    <span className="text-center">
                      <span className="block font-heading text-2xl font-bold">
                        {total}
                        {bonus > 0 && <span className="ml-1 text-sm text-success">+{bonus}</span>}
                      </span>
                      <span className="block text-xs text-muted">{fmtMod(modOf(total))}</span>
                    </span>
                    <button
                      type="button"
                      className={stepBtn}
                      aria-label={`Mejorar ${ABILITY_NAMES[a]}`}
                      disabled={left <= 0 || bonus >= 2 || total >= ABILITY_CAP}
                      onClick={() => step(a, 1)}
                    >
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="animate-fade-in space-y-3" key="feat">
          <RuleSelect
            id="level-up-asi-feat"
            label="Dote general"
            options={feats}
            value={value.feat ? refFromKey(value.feat) : null}
            onChange={(r) => onChange({ ...value, feat: r ? refKey(r) : "", ability: "", resist: [] })}
            placeholder="Busca una dote"
          />
          <p className="text-xs text-muted">Solo aparecen las dotes generales cuyos requisitos cumples y que aún no tienes.</p>
          {value.feat && (
            <div className="rounded-md border border-line bg-surface p-3" key={value.feat}>
              <div className="max-h-64 overflow-y-auto">
                <Description entry={entry(refFromKey(value.feat))} />
              </div>
              <FeatAbilityField
                id="level-up-asi-feat-ability"
                feat={feat}
                value={value.ability}
                scores={scores}
                onChange={(ability) => onChange({ ...value, ability })}
              />
              {choose && (
                <FeatResistField
                  id="level-up-asi-feat-resist"
                  count={choose.count}
                  from={choose.from}
                  value={value.resist}
                  onChange={(resist) => onChange({ ...value, resist })}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
