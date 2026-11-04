"use client";

import type { EntryOption } from "@/lib/rules/catalog/types";
import type { LanguageSlot } from "@/lib/rules/dnd2024/creation/languages";
import { FIXED_LANGUAGE_NAMES_ES, languageName } from "@/lib/rules/dnd2024/creation/languages";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { LanguageData, Ref } from "@/lib/rules/types";
import SkillPicker from "../fields/SkillPicker";
import { refFromKey } from "./ClassFeaturesSection";

const nameOf = (o: EntryOption) => o.nameEs ?? o.name;

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
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2" aria-label="Idiomas que ya conoces">
        {fixed.map((key) => (
          <li key={key} className="rounded-full border border-line bg-surface px-3 py-1 text-sm">
            {(() => {
              const found = languages.find((l) => languageName(l.ref.key) === languageName(key));
              return found ? nameOf(found) : (FIXED_LANGUAGE_NAMES_ES[languageName(key)] ?? languageName(key));
            })()}
          </li>
        ))}
      </ul>
      {legacyText && <p className="text-sm text-muted">Anotados antes: {legacyText}</p>}
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
          <SkillPicker
            key={slot.source}
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
        );
      })}
    </div>
  );
}
