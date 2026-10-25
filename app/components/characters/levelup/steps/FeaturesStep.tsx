"use client";

import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { Ref } from "@/lib/rules/types";
import { FeatureList } from "../../ClassFeaturesSection";

/* Rasgos automáticos: los rasgos nuevos de la clase y de la subclase en este nivel, plegables con su descripción. */
export default function FeaturesStep({ level, classLevel, className, features, subclass, entry }: {
  /** Nivel total que alcanza. */
  level: number;
  classLevel: number;
  className: string;
  features: Ref[];
  /** Subclase (ya elegida) y sus rasgos de este nivel. */
  subclass: { name: string; features: Ref[] } | null;
  entry: (r: Ref) => CatalogEntry | null | undefined;
}) {
  const none = features.length === 0 && !subclass?.features.length;
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Obtienes o mejoras los siguientes rasgos al alcanzar el nivel {level} ({className} {classLevel}).
      </p>
      {none && <p className="text-sm text-muted">Este nivel no da rasgos de clase nuevos.</p>}
      {features.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Rasgos de {className}</h3>
          <FeatureList features={features} entry={entry} open />
        </div>
      )}
      {subclass && subclass.features.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Rasgos de {subclass.name}</h3>
          <FeatureList features={subclass.features} entry={entry} />
        </div>
      )}
    </div>
  );
}
