"use client";

import { labelClass } from "@/app/components/formStyles";
import { PRONOUNS, type Pronoun } from "@/lib/rules/dnd2024/names";

/* Pronombres del personaje: Él, Ella, Elle (se pueden marcar varios o ninguno). */
export default function PronounsField({ value, onChange }: { value: Pronoun[]; onChange: (value: Pronoun[]) => void }) {
  const toggle = (p: Pronoun) =>
    onChange(PRONOUNS.map((x) => x.id).filter((id) => (id === p ? !value.includes(p) : value.includes(id))));
  return (
    <fieldset>
      <legend className={labelClass}>Pronombres</legend>
      <div className="flex flex-wrap gap-2">
        {PRONOUNS.map((p) => {
          const on = value.includes(p.id);
          return (
            <label
              key={p.id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors has-focus-visible:border-brand ${
                on ? "border-brand bg-brand/10 font-semibold" : "border-line hover:border-brand"
              }`}
            >
              <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(p.id)} />
              {p.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
