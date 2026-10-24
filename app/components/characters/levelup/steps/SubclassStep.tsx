"use client";

import type { CatalogEntry } from "@/lib/rules/catalog";
import { refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import type { Ref, SubclassData } from "@/lib/rules/types";
import RuleSelect from "../../RuleSelect";
import { Description, FeatureList } from "../../ClassFeaturesSection";

/* Subclase: desplegable con las de la clase, su descripción y los rasgos que da en este nivel. */
export default function SubclassStep({ label, className, classLevel, options, value, onChange, entry }: {
  /** «Senda primitiva», «Dominio divino»… */
  label: string;
  className: string;
  classLevel: number;
  options: CatalogEntry[];
  value: string;
  onChange: (key: string) => void;
  entry: (r: Ref) => CatalogEntry | null | undefined;
}) {
  const selected = options.find((o) => refKey(o.ref) === value) ?? null;
  const features = selected
    ? (selected.data as SubclassData).features.filter((f) => f.level === classLevel).map((f) => f.ref)
    : [];
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">Al llegar a {className} {classLevel} eliges tu {label.toLowerCase()}.</p>
      {options.length === 0 ? (
        <p role="alert" className="text-sm text-brand-soft">No hay subclases de {className} en los libros de este personaje.</p>
      ) : (
        <RuleSelect
          id="level-up-subclass"
          label={label}
          options={options}
          value={selected?.ref ?? null}
          onChange={(r) => onChange(r ? refKey(r) : "")}
        />
      )}
      {selected && (
        <div className="animate-fade-in space-y-4" key={value}>
          <div className="max-h-72 overflow-y-auto rounded-md border border-line bg-surface p-3">
            <Description entry={selected} />
          </div>
          {features.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Rasgos de nivel {classLevel}</h3>
              <FeatureList features={features} entry={entry} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
