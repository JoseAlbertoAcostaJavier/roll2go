"use client";

import type { ReactNode } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import Bbcode from "@/app/components/Bbcode";
import type { CatalogEntry, EntryOption } from "@/lib/rules/catalog/types";
import { weaponProficient } from "@/lib/rules/dnd2024/derive/attacks";
import { bareName, refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { FEATURE_OPTION_LABELS } from "@/lib/rules/dnd2024/levels/featureChoices";
import { SKILL_NAMES, featFitsCategories, skillName } from "@/lib/rules/dnd2024/sheet/labels";
import type { PendingChoice } from "@/lib/rules/dnd2024/levels/pendingChoices";
import { isMasteryWeapon, masteryLabel, meleeOnlySource } from "@/lib/rules/dnd2024/levels/masteries";
import type { Choice } from "@/lib/rules/dnd2024/sheet/sheet";
import type { ClassData, FeatData, ItemData, OptionalFeatureData, Ref } from "@/lib/rules/types";
import FieldError from "./fields/FieldError";
import SkillPicker, { type PickerOption } from "./fields/SkillPicker";

/** Lo elegido en cada elección pendiente, por `source`: habilidades o claves `libro:clave` de las entradas. */
export type ChoiceValues = Record<string, string[]>;

type Cache = Record<string, CatalogEntry | null>;

const ALL_SKILLS = Object.keys(SKILL_NAMES);
const nameOf = (e: { nameEs: string | null; name: string }) => e.nameEs ?? e.name;
const lower = (s: string) => s.toLowerCase();
// "classFeature:protector|cleric|xphb|1" → "Protector"
export const nameFromKey = (key: string) => {
  const bare = bareName(key);
  return bare ? bare[0].toUpperCase() + bare.slice(1) : key;
};

/** `libro:clave` → referencia (los ids de libro no llevan «:»). */
export function refFromKey(k: string): Ref {
  const i = k.indexOf(":");
  return { book: k.slice(0, i), key: k.slice(i + 1) };
}

/** Las elecciones para enviar (sin nombres: los pone el servidor), en el orden de `pending`. */
export function choicesFor(pending: PendingChoice[], values: ChoiceValues): Choice[] {
  return pending.flatMap((p): Choice[] => {
    const v = (values[p.source] ?? []).filter(Boolean);
    const named = (k: string) => ({ ref: refFromKey(k), name: "" });
    switch (p.type) {
      case "skills":
      case "expertise":
        return [{ type: p.type, source: p.source, value: v }];
      case "weaponMastery":
        return [{ type: p.type, source: p.source, value: v.map(refFromKey) }];
      case "featureOption":
        return v[0] ? [{ type: p.type, source: p.source, value: named(v[0]) }] : [];
      case "feat":
      case "optionalFeature":
        return [{ type: p.type, source: p.source, value: v.map(named) }];
      default:
        return [];
    }
  });
}

/** Elecciones pendientes que aún no están completas. */
export const unfinished = (pending: PendingChoice[], values: ChoiceValues) =>
  pending.filter((p) => p.type !== "subclass" && (values[p.source] ?? []).filter(Boolean).length < p.count);

export function Description({ entry }: { entry: CatalogEntry | null | undefined }) {
  if (entry === undefined)
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> Cargando descripción…
      </p>
    );
  const text = entry ? entry.descriptionEs || entry.description : "";
  if (!text) return <p className="text-sm text-muted">{entry ? "Sin descripción." : "Contenido no disponible."}</p>;
  return <Bbcode source={text} className="text-sm" />;
}

/** Lo que hace falta para calcular las opciones de cada elección (creador y asistente de subir de nivel). */
export type ChoiceCtx = {
  pending: PendingChoice[];
  values: ChoiceValues;
  /** Entrada cargada por referencia; undefined = cargando, null = no disponible. */
  entry: (r: Ref) => CatalogEntry | null | undefined;
  /** Habilidades con competencia antes de estas elecciones. */
  takenSkills: string[];
  /** Habilidades con pericia antes de estas elecciones. */
  expertSkills?: string[];
  feats: EntryOption[];
  optionalFeatures: EntryOption[];
  weapons: EntryOption[];
  /** Competencias con armas (para las maestrías). */
  weaponProficiencies: string[];
  /** Nivel de clase (prerrequisitos de nivel de los rasgos opcionales). */
  classLevel: number;
  /** Dotes y rasgos opcionales que ya conserva de cada elección (`heldPicks`): no se repiten. */
  held?: Map<string, { ref: Ref }[]>;
  /** Armas con las que ya tiene maestría (`libro:clave`). */
  masteries?: string[];
  /** Por qué no puede elegir una dote (prerrequisitos, ya la tiene); null si puede. */
  featBlocked?: (f: EntryOption) => string | null;
};

/** Opciones de una elección: sin las que ya tiene ni las elegidas en otras; las que no puede elegir, con el motivo. */
export function choiceOptions(p: PendingChoice, ctx: ChoiceCtx): PickerOption[] {
  const taken = ctx.takenSkills.map(lower);
  const chosenBy = (type: Choice["type"], except: string) =>
    ctx.pending.filter((q) => q.type === type && q.source !== except)
      .flatMap((q) => ctx.values[q.source] ?? []).filter(Boolean).map(lower);
  const held = new Set((ctx.held?.get(p.source) ?? []).map((h) => refKey(h.ref)));
  switch (p.type) {
    case "skills": {
      const others = chosenBy("skills", p.source);
      return (p.from ?? ALL_SKILLS)
        .filter((s) => !taken.includes(lower(s)) && !others.includes(lower(s)))
        .map((s) => ({ id: s, label: skillName(s) }));
    }
    case "expertise": {
      const proficient = [...taken, ...chosenBy("skills", "")];
      const expert = [...(ctx.expertSkills ?? []).map(lower), ...chosenBy("expertise", p.source)];
      return (p.from ?? ALL_SKILLS)
        .filter((s) => proficient.includes(lower(s)) && !expert.includes(lower(s)))
        .map((s) => ({ id: s, label: skillName(s) }));
    }
    case "weaponMastery":
      return ctx.weapons
        .filter((w) => isMasteryWeapon(w.data as ItemData, meleeOnlySource(p.source))
          && weaponProficient(w.data as ItemData, [w.name, bareName(w.ref.key)], ctx.weaponProficiencies)
          && !ctx.masteries?.includes(refKey(w.ref)))
        .map((w) => ({ id: refKey(w.ref), label: masteryLabel(nameOf(w), (w.data as ItemData).weapon?.mastery) }));
    case "featureOption":
      return p.options?.length
        ? p.options.map((o) => {
          const e = ctx.entry(o);
          return { id: refKey(o), label: e ? nameOf(e) : nameFromKey(o.key) };
        })
        : (p.from ?? []).map((id) => ({ id: `builtin:${id}`, label: FEATURE_OPTION_LABELS[id] ?? id }));
    case "feat": {
      return ctx.feats
        .filter((f) => featFitsCategories(f.data as FeatData | null, p.category) && !held.has(refKey(f.ref)))
        .map((f) => {
          const blocked = ctx.featBlocked?.(f);
          return { id: refKey(f.ref), label: nameOf(f), ...(blocked ? { disabled: blocked } : {}) };
        });
    }
    case "optionalFeature": {
      // Los prerrequisitos de pacto o de otro rasgo se cumplen con los que conserva o con los elegidos ahora
      const have = [...held, ...(ctx.values[p.source] ?? []).filter(Boolean)].map((k) => refFromKey(k).key);
      const nameByKey = (key: string) => {
        const o = ctx.optionalFeatures.find((x) => x.ref.key === key);
        return o ? nameOf(o) : nameFromKey(key);
      };
      return ctx.optionalFeatures
        .filter((o) => {
          const d = o.data as OptionalFeatureData | null;
          return !!d && d.featureType.some((t) => p.featureType?.includes(t)) && !held.has(refKey(o.ref));
        })
        .map((o) => {
          const pre = (o.data as OptionalFeatureData).prerequisite;
          const blocked = pre?.level && pre.level > ctx.classLevel ? `Requiere nivel ${pre.level}`
            : pre?.pact && !have.includes(pre.pact) ? `Requiere ${nameByKey(pre.pact)}`
              : pre?.feature && !have.includes(pre.feature) ? `Requiere ${nameByKey(pre.feature)}`
                : null;
          return { id: refKey(o.ref), label: nameOf(o), ...(blocked ? { disabled: blocked } : {}) };
        });
    }
    default:
      return [];
  }
}

/* Una elección: la fila de desplegables y, para las que eligen un rasgo o una dote, la descripción de lo elegido. */
export function ChoiceField({
  p, ctx, onChange, count = p.count, hint, label = p.label, children,
}: {
  p: PendingChoice;
  ctx: ChoiceCtx;
  onChange: (value: string[]) => void;
  /** Desplegables (por defecto, `p.count`; uno más si además sustituye uno). */
  count?: number;
  hint?: string;
  label?: string;
  /** Contenido bajo la descripción de cada elegida (p. ej. la característica que mejora una dote), por `libro:clave`. */
  children?: (key: string) => ReactNode;
}) {
  const chosen = (ctx.values[p.source] ?? []).slice(0, count).filter(Boolean);
  // Descripción de lo elegido (Orden divina, estilo de combate, invocación…)
  const describes = p.type === "featureOption" || p.type === "feat" || p.type === "optionalFeature";
  return (
    <div>
      <SkillPicker
        id={`choice-${p.source.replace(/[^a-z0-9]+/gi, "-")}`}
        label={label}
        count={count}
        options={choiceOptions(p, ctx)}
        value={ctx.values[p.source] ?? []}
        onChange={onChange}
        hint={hint}
      />
      {describes && chosen.map((k) => (
        k.startsWith("builtin:") ? null : (
          <div key={k} className="mt-2 animate-fade-in rounded-md border border-line bg-surface p-3">
            <div className="max-h-56 overflow-y-auto">
              <Description entry={ctx.entry(refFromKey(k))} />
            </div>
            {children?.(k)}
          </div>
        )
      ))}
    </div>
  );
}

/** Rasgos plegables con su descripción. */
export function FeatureList({ features, entry, open = false }: {
  features: Ref[];
  entry: (r: Ref) => CatalogEntry | null | undefined;
  /** Si el primero sale desplegado. */
  open?: boolean;
}) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {features.map((r, i) => {
        const e = entry(r);
        return (
          <li key={refKey(r)}>
            <details open={open && i === 0} className="group/feat">
              <summary className="flex cursor-pointer list-none items-center gap-3 py-3 hover:text-white">
                <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-muted transition-transform group-open/feat:rotate-180" />
                <span className="flex-1 font-semibold">{e ? nameOf(e) : nameFromKey(r.key)}</span>
              </summary>
              <div className="pb-4 pl-7">
                <Description entry={e} />
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

/* Rasgos de clase de nivel 1 del creador: los automáticos (plegables) y un desplegable por cada elección que pide
   `pendingChoices` (habilidades de clase, Orden divina, estilo de combate, pericia, maestrías…). */
export default function ClassFeaturesSection({
  classData, pending, values, onChange, cache, takenSkills, feats, optionalFeatures, weapons, errors,
}: {
  classData: ClassData;
  pending: PendingChoice[];
  values: ChoiceValues;
  onChange: (source: string, value: string[]) => void;
  /** Entradas cargadas (rasgos, opciones, dotes elegidas…), por `libro:clave`; undefined = cargando. */
  cache: Cache;
  /** Habilidades que ya dan el trasfondo y la especie, con el texto de esa fuente. */
  takenSkills: Record<string, string>;
  feats: EntryOption[];
  optionalFeatures: EntryOption[];
  weapons: EntryOption[];
  errors: Record<string, string>;
}) {
  const features = classData.features.filter((f) => f.level === 1);
  const loadingFeatures = features.some((f) => cache[refKey(f.ref)] === undefined);
  const takenHint = Object.entries(takenSkills).map(([s, from]) => `${skillName(s)} (${from})`).join(", ");
  const ctx: ChoiceCtx = {
    pending, values, entry: (r) => cache[refKey(r)], takenSkills: Object.keys(takenSkills),
    feats, optionalFeatures, weapons, weaponProficiencies: classData.weapons, classLevel: 1,
  };

  return (
    <div className="space-y-5">
      <FieldError errors={errors} keys={["levels.0.choices"]} />
      {pending.map((p) => (
        <div key={`${p.type}-${p.source}`}>
          <ChoiceField
            p={p}
            ctx={ctx}
            onChange={(v) => onChange(p.source, v)}
            hint={p.type === "skills" && takenHint ? `Ya tienes: ${takenHint}.` : undefined}
          />
          <FieldError errors={errors} keys={[`levels.0.choices.${p.source}`]} />
        </div>
      ))}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Rasgos de nivel 1</h3>
        {loadingFeatures && (
          <p className="mb-2 flex items-center gap-2 text-sm text-muted">
            <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> Cargando rasgos…
          </p>
        )}
        <FeatureList features={features.map((f) => f.ref)} entry={(r) => cache[refKey(r)]} />
      </div>
    </div>
  );
}
