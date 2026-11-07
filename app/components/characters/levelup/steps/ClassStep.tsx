"use client";

import { Check, Lock } from "lucide-react";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { bareName } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import RoundIcon from "@/app/components/ui/RoundIcon";

export type ClassChoice = {
  key: string;
  entry: CatalogEntry;
  /** Nivel en la clase tras subir (1 = clase nueva). */
  nextLevel: number;
  /** Motivo por el que no puede entrar (requisito de multiclase); null si puede. */
  blocked: string | null;
};

export function ClassIcon({ entry, size = 28 }: { entry: CatalogEntry | undefined; size?: number }) {
  const id = entry ? entry.identifier || bareName(entry.ref.key) : null;
  return <RoundIcon kind="class" id={id} label={entry ? (entry.nameEs ?? entry.name) : ""} size={size} />;
}

/* Paso 1: subir en una clase que ya tiene o entrar en otra (multiclase). Las que no cumplen el requisito salen
   desactivadas con el motivo. */
export default function ClassStep({ options, value, onChange }: {
  options: ClassChoice[];
  value: string;
  onChange: (key: string) => void;
}) {
  const owned = options.filter((o) => o.nextLevel > 1);
  const others = options.filter((o) => o.nextLevel === 1);
  const group = (title: string, list: ClassChoice[]) => list.length > 0 && (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-white">{title}</legend>
      <div className="grid gap-2.5 sm:grid-cols-2">
      {list.map((o) => {
        const selected = o.key === value;
        return (
          <label
            key={o.key}
            className={`flex items-center gap-3 rounded-xl border p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-soft ${
              o.blocked ? "cursor-not-allowed border-line opacity-60"
                : selected ? "cursor-pointer border-brand bg-brand/10" : "cursor-pointer border-line bg-surface/40 hover:border-line-strong hover:bg-surface"
            }`}
          >
            <input
              type="radio"
              name="level-up-class"
              value={o.key}
              aria-label={o.entry.nameEs ?? o.entry.name}
              aria-describedby={o.blocked ? `blocked-${o.entry.ref.key.replace(/[^a-z0-9]+/gi, "-")}` : undefined}
              checked={selected}
              disabled={!!o.blocked}
              onChange={() => onChange(o.key)}
              className="sr-only"
            />
            <ClassIcon entry={o.entry} size={44} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-heading text-sm font-bold text-white">{o.entry.nameEs ?? o.entry.name}</span>
              <span className="block text-xs text-muted">
                {o.nextLevel > 1 ? `Nivel ${o.nextLevel - 1} → ${o.nextLevel}` : "Nueva clase (multiclase)"}
              </span>
              {o.blocked && (
                <span id={`blocked-${o.entry.ref.key.replace(/[^a-z0-9]+/gi, "-")}`} className="mt-0.5 flex items-center gap-1 text-xs text-brand-soft">
                  <Lock size={12} aria-hidden="true" /> {o.blocked}
                </span>
              )}
            </span>
            {selected && <Check size={16} strokeWidth={3} aria-hidden="true" className="shrink-0 text-brand-soft" />}
          </label>
        );
      })}
      </div>
    </fieldset>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Sube en una de tus clases o empieza otra. Para entrar en una clase nueva necesitas 13 o más en la característica
        principal de cada una de tus clases y de la nueva.
      </p>
      {group("Tus clases", owned)}
      {group("Otras clases", others)}
    </div>
  );
}
