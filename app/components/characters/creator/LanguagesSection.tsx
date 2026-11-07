"use client";

import { Check, Globe, Languages } from "lucide-react";
import type { EntryOption } from "@/lib/rules/catalog/types";
import type { LanguageSlot } from "@/lib/rules/dnd2024/creation/languages";
import { FIXED_LANGUAGE_NAMES_ES, languageName } from "@/lib/rules/dnd2024/creation/languages";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { LanguageData, Ref } from "@/lib/rules/types";
import SkillPicker from "../fields/SkillPicker";
import { refFromKey } from "./ClassFeaturesSection";

const nameOf = (o: EntryOption) => o.nameEs ?? o.name;
const heading = "mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white";

/* Idiomas del personaje: los que da la clase (chips) y un desplegable por cada hueco. `choices` lleva una posición por
   idioma a elegir, en el orden de los huecos; lo elegido en un desplegable no se ofrece en los demás. */
export default function LanguagesSection({
  fixed, slots, languages, choices, onChange, legacyText,
}: {
  /** Claves (sin libro) de los idiomas que se conocen sin elegir. */
  fixed: string[];
  slots: LanguageSlot[];
  languages: EntryOption[];
  choices: (Ref | null)[];
  onChange: (choices: (Ref | null)[]) => void;
  /** Texto libre de un borrador antiguo, si lo hay. */
  legacyText: string;
}) {
  const byKey = new Map<string, EntryOption>();
  for (const l of languages) if (!byKey.has(l.ref.key)) byKey.set(l.ref.key, l);

  const starts = slots.map((_, i) => slots.slice(0, i).reduce((n, x) => n + x.count, 0));
  return (
    <div className="space-y-6">
      {fixed.length > 0 && (
        <div>
          <h3 className={heading}><Globe size={16} className="text-brand-soft" aria-hidden="true" /> Idiomas conocidos</h3>
          <ul className="flex flex-wrap gap-2" aria-label="Idiomas que ya conoces">
            {fixed.map((key) => {
              const found = languages.find((l) => languageName(l.ref.key) === languageName(key));
              return (
                <li key={key} className="flex items-center gap-1.5 rounded-lg border border-line bg-surface/50 px-3 py-1.5 text-sm font-medium text-white">
                  <Check size={14} strokeWidth={3} className="text-brand-soft" aria-hidden="true" />
                  {found ? nameOf(found) : (FIXED_LANGUAGE_NAMES_ES[languageName(key)] ?? languageName(key))}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {legacyText && <p className="rounded-lg border border-line bg-surface/50 p-3 text-sm text-muted">Anotados antes: {legacyText}</p>}
      {slots.some((s) => s.count > 0) && (
        <h3 className={`${heading} -mb-3`}><Languages size={16} className="text-brand-soft" aria-hidden="true" /> Idiomas adicionales</h3>
      )}
      {slots.map((slot, si) => {
        if (slot.count === 0) return null;
        const start = starts[si];
        const own = Array.from({ length: slot.count }, (_, i) => choices[start + i] ?? null);
        const others = choices.filter((c, i) => c && (i < start || i >= start + slot.count)) as Ref[];
        const seen = new Set([...fixed, ...others.map((o) => o.key)].map(languageName));
        const options = [...byKey.values()]
          .filter((l) => !seen.has(languageName(l.ref.key)) && seen.add(languageName(l.ref.key)))
          .filter((l) => !slot.standardOnly || (l.data as LanguageData | null)?.type === "standard")
          .map((l) => ({ id: refKey(l.ref), label: nameOf(l) }));
        return (
          <div key={slot.source} className="rounded-xl border border-line bg-surface/30 p-5">
          <SkillPicker
            id={`language-${slot.source}`}
            label={slot.label}
            count={slot.count}
            options={options}
            value={own.map((c) => (c ? refKey(c) : ""))}
            onChange={(v) => {
              const next = [...choices];
              while (next.length < start + slot.count) next.push(null);
              v.forEach((k, i) => (next[start + i] = k ? refFromKey(k) : null));
              onChange(next);
            }}
            hint={slot.standardOnly ? "Solo idiomas estándar." : undefined}
          />
          </div>
        );
      })}
    </div>
  );
}
