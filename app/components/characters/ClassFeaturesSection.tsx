"use client";

import { ChevronDown, LoaderCircle } from "lucide-react";
import Bbcode from "@/app/components/Bbcode";
import type { CatalogEntry, EntryOption } from "@/lib/rules/catalog";
import { weaponProficient } from "@/lib/rules/dnd2024/derive/attacks";
import { bareName, refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import { FEATURE_OPTION_LABELS } from "@/lib/rules/dnd2024/featureChoices";
import { FEAT_CATEGORIES, SKILL_NAMES, skillName } from "@/lib/rules/dnd2024/labels";
import type { PendingChoice } from "@/lib/rules/dnd2024/levels";
import { isMasteryWeapon, masteryLabel, meleeOnlySource } from "@/lib/rules/dnd2024/masteries";
import type { Choice } from "@/lib/rules/dnd2024/sheet";
import type { ClassData, FeatData, ItemData, OptionalFeatureData, Ref } from "@/lib/rules/types";
import FieldError from "./fields/FieldError";
import SkillPicker, { type PickerOption } from "./fields/SkillPicker";

/** Lo elegido en cada elección pendiente, por `source`: habilidades o claves `libro:clave` de las entradas. */
export type ChoiceValues = Record<string, string[]>;

type Cache = Record<string, CatalogEntry | null>;

const ALL_SKILLS = Object.keys(SKILL_NAMES);
const nameOf = (e: { nameEs: string | null; name: string }) => e.nameEs ?? e.name;
// "classFeature:protector|cleric|xphb|1" → "Protector"
const nameFromKey = (key: string) => {
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

function Description({ entry }: { entry: CatalogEntry | null | undefined }) {
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
  const lower = (s: string) => s.toLowerCase();
  const taken = Object.keys(takenSkills).map(lower);
  const chosenBy = (type: Choice["type"], except: string) =>
    pending.filter((p) => p.type === type && p.source !== except).flatMap((p) => values[p.source] ?? []).filter(Boolean).map(lower);
  const takenHint = Object.entries(takenSkills).map(([s, from]) => `${skillName(s)} (${from})`).join(", ");

  function optionsFor(p: PendingChoice): PickerOption[] {
    const entry = (r: Ref) => cache[refKey(r)];
    switch (p.type) {
      case "skills": {
        const others = chosenBy("skills", p.source);
        return (p.from ?? ALL_SKILLS)
          .filter((s) => !taken.includes(lower(s)) && !others.includes(lower(s)))
          .map((s) => ({ id: s, label: skillName(s) }));
      }
      case "expertise": {
        const proficient = [...taken, ...chosenBy("skills", "")];
        const others = chosenBy("expertise", p.source);
        return (p.from ?? ALL_SKILLS)
          .filter((s) => proficient.includes(lower(s)) && !others.includes(lower(s)))
          .map((s) => ({ id: s, label: skillName(s) }));
      }
      case "weaponMastery":
        return weapons
          .filter((w) => isMasteryWeapon(w.data as ItemData, meleeOnlySource(p.source))
            && weaponProficient(w.data as ItemData, [w.name, bareName(w.ref.key)], classData.weapons))
          .map((w) => ({ id: refKey(w.ref), label: masteryLabel(nameOf(w), (w.data as ItemData).weapon?.mastery) }));
      case "featureOption":
        return p.options?.length
          ? p.options.map((o) => {
            const e = entry(o);
            return { id: refKey(o), label: e ? nameOf(e) : nameFromKey(o.key) };
          })
          : (p.from ?? []).map((id) => ({ id: `builtin:${id}`, label: FEATURE_OPTION_LABELS[id] ?? id }));
      case "feat": {
        const categories = (p.category ?? []).map((c) => FEAT_CATEGORIES[c]);
        return feats
          .filter((f) => categories.includes((f.data as FeatData | null)?.category ?? "origin"))
          .map((f) => ({ id: refKey(f.ref), label: nameOf(f) }));
      }
      case "optionalFeature":
        return optionalFeatures
          .filter((o) => {
            const d = o.data as OptionalFeatureData | null;
            return !!d && d.featureType.some((t) => p.featureType?.includes(t))
              && (d.prerequisite?.level ?? 0) <= 1 && !d.prerequisite?.pact && !d.prerequisite?.feature;
          })
          .map((o) => ({ id: refKey(o.ref), label: nameOf(o) }));
      default:
        return [];
    }
  }

  // Descripción de lo elegido (Orden divina, estilo de combate, invocación…)
  const describes = (p: PendingChoice) => p.type === "featureOption" || p.type === "feat" || p.type === "optionalFeature";

  return (
    <div className="space-y-5">
      <FieldError errors={errors} keys={["levels.0.choices"]} />
      {pending.map((p) => {
        const chosen = (values[p.source] ?? []).filter(Boolean);
        return (
          <div key={`${p.type}-${p.source}`}>
            <SkillPicker
              id={`choice-${p.source.replace(/[^a-z0-9]+/gi, "-")}`}
              label={p.label}
              count={p.count}
              options={optionsFor(p)}
              value={values[p.source] ?? []}
              onChange={(v) => onChange(p.source, v)}
              hint={p.type === "skills" && takenHint ? `Ya tienes: ${takenHint}.` : undefined}
            />
            <FieldError errors={errors} keys={[`levels.0.choices.${p.source}`]} />
            {describes(p) && chosen.map((k) => (
              k.startsWith("builtin:") ? null : (
                <div key={k} className="mt-2 max-h-56 overflow-y-auto rounded-md border border-line bg-surface p-3">
                  <Description entry={cache[k]} />
                </div>
              )
            ))}
          </div>
        );
      })}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Rasgos de nivel 1</h3>
        {loadingFeatures && (
          <p className="mb-2 flex items-center gap-2 text-sm text-muted">
            <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> Cargando rasgos…
          </p>
        )}
        <ul className="divide-y divide-line border-y border-line">
          {features.map((f) => {
            const e = cache[refKey(f.ref)];
            return (
              <li key={refKey(f.ref)}>
                <details className="group/feat">
                  <summary className="flex cursor-pointer list-none items-center gap-3 py-3 hover:text-white">
                    <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-muted transition-transform group-open/feat:rotate-180" />
                    <span className="flex-1 font-semibold">{e ? nameOf(e) : nameFromKey(f.ref.key)}</span>
                  </summary>
                  <div className="pb-4 pl-7">
                    <Description entry={e} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
