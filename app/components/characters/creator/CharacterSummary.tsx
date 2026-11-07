"use client";

import { useMemo } from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { derive } from "@/lib/rules/dnd2024/derive";
import type { Dnd2024Sheet } from "@/lib/rules/dnd2024/sheet/sheet";
import { fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import SectionIndex, { SectionLinkAnchor, type SectionLink } from "./SectionIndex";

/** `focusId`: control concreto que falta; sin él, el foco va al primer control de la sección. */
export type MissingItem = { label: string; href: string; focusId?: string };

/* Resumen lateral del asistente: valores derivados de lo elegido hasta ahora y lo que falta por completar.
   `entries` son las entradas del catálogo ya cargadas, por "libro:clave". */
export default function CharacterSummary({
  sheet, entries, hasSpecies, hasClass, equipmentLoading, missing, sections,
}: {
  sheet: Dnd2024Sheet;
  entries: Map<string, CatalogEntry>;
  hasSpecies: boolean;
  hasClass: boolean;
  /** Mientras se cargan los objetos del equipo, la CA se calcula sin armadura. */
  equipmentLoading: boolean;
  missing: MissingItem[];
  /** Índice de secciones (en escritorio; en móvil lo muestra el creador plegado al principio). */
  sections: SectionLink[];
}) {
  const d = useMemo(() => derive(sheet, entries), [sheet, entries]);

  const stats: { label: string; value: string }[] = [
    { label: "PG", value: hasClass ? String(d.hp.max) : "—" },
    { label: "CA", value: String(d.ac) },
    { label: "Iniciativa", value: fmtMod(d.initiative) },
    { label: "Velocidad", value: hasSpecies ? `${d.speed} pies` : "—" },
    { label: "Competencia", value: fmtMod(d.proficiencyBonus) },
  ];

  return (
    <aside aria-label="Resumen del personaje" className="rounded-lg border border-line bg-panel p-5">
      <h2 className="mb-4 border-l-4 border-brand pl-3 font-heading text-lg font-bold">Resumen</h2>
      <dl className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-md bg-surface px-3 py-2">
            <dt className="text-xs uppercase tracking-wide text-muted">{s.label}</dt>
            <dd className="font-heading text-xl font-bold">{s.value}</dd>
          </div>
        ))}
      </dl>
      {equipmentLoading && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> Cargando el equipo…
        </p>
      )}

      <div className="hidden lg:block">
        <h3 className="mb-2 mt-5 text-sm font-semibold">Secciones</h3>
        <SectionIndex sections={sections} />
      </div>

      <h3 className="mb-2 mt-5 flex items-center gap-2 text-sm font-semibold">
        {missing.length > 0 && <CircleAlert size={16} className="text-brand-soft" aria-hidden="true" />}
        Falta por completar
      </h3>
      {missing.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <CircleCheck size={16} aria-hidden="true" /> ¡Todo listo!
        </p>
      ) : (
        <ul className="space-y-1 text-sm">
          {missing.map((m) => (
            <li key={m.label}>
              <SectionLinkAnchor href={m.href} focusId={m.focusId} className="text-brand-soft hover:underline">{m.label}</SectionLinkAnchor>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
