"use client";

import { ChevronDown } from "lucide-react";
import Bbcode from "@/app/components/Bbcode";
import type { CatalogEntry } from "@/lib/rules/catalog";
import { refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import type { ClassData, Ref } from "@/lib/rules/types";
import { nameFromKey } from "../ClassFeaturesSection";
import { ClassIcon } from "./steps/ClassStep";

// Al abrir la tabla, la fila del nuevo nivel queda a la vista (sin mover la página)
function showCurrentRow(e: React.SyntheticEvent<HTMLDetailsElement>) {
  const box = e.currentTarget.querySelector<HTMLElement>("[data-class-table]");
  const row = box?.querySelector<HTMLElement>("tr[aria-current]");
  if (e.currentTarget.open && box && row) box.scrollTop = Math.max(0, row.offsetTop - box.clientHeight / 2);
}

const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);
const proficiencyOf = (level: number) => Math.ceil(level / 4) + 1;

function ClassTable({ data, classLevel, entry }: {
  data: ClassData;
  classLevel: number;
  entry: (r: Ref) => CatalogEntry | null | undefined;
}) {
  const featuresAt = (l: number) => data.features
    .filter((f) => f.level === l)
    .map((f) => {
      const e = entry(f.ref);
      return e ? (e.nameEs ?? e.name) : nameFromKey(f.ref.key);
    })
    .join(", ");
  const columns = data.table?.columns ?? [];
  return (
    <div data-class-table className="max-h-96 overflow-auto rounded-md border border-line">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-panel text-muted">
          <tr>
            <th scope="col" className="px-2 py-2 font-semibold">Nivel</th>
            <th scope="col" className="px-2 py-2 font-semibold">Comp.</th>
            <th scope="col" className="px-2 py-2 font-semibold">Rasgos de clase</th>
            {columns.map((c) => <th key={c.label} scope="col" className="px-2 py-2 font-semibold">{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {LEVELS.map((l) => {
            const current = l === classLevel;
            return (
              <tr
                key={l}
                aria-current={current ? "true" : undefined}
                className={current ? "bg-brand/15 font-semibold text-white" : l < classLevel ? "text-muted" : ""}
              >
                <td className="px-2 py-1.5">{l}</td>
                <td className="px-2 py-1.5">+{proficiencyOf(l)}</td>
                <td className="min-w-40 px-2 py-1.5">{featuresAt(l) || "—"}</td>
                {columns.map((c) => <td key={c.label} className="px-2 py-1.5">{c.values[l - 1] || "—"}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* Tarjeta de la clase en la que sube: icono, descripción, dado de golpe y la tabla de la clase con la fila del nuevo
   nivel resaltada. En móvil va arriba y plegada. */
export default function ClassCard({ classEntry, classLevel, entry, collapsible = false }: {
  classEntry: CatalogEntry;
  classLevel: number;
  /** Entradas cargadas (nombres de los rasgos). */
  entry: (r: Ref) => CatalogEntry | null | undefined;
  collapsible?: boolean;
}) {
  const data = classEntry.data as ClassData;
  const name = classEntry.nameEs ?? classEntry.name;
  const description = classEntry.descriptionEs || classEntry.description;
  const heading = (
    <span className="flex items-center gap-3">
      <ClassIcon entry={classEntry} size={48} />
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-wide text-muted">Nuevo nivel</span>
        <span className="block font-heading text-xl font-bold">{name} {classLevel}</span>
      </span>
    </span>
  );
  const body = (
    <div className="mt-4 space-y-4">
      {description && (
        <div className="max-h-48 overflow-y-auto pr-1">
          <Bbcode source={description} className="text-sm" />
        </div>
      )}
      <p className="text-sm"><span className="font-semibold">Dado de golpe.</span> 1d{data.hitDie}</p>
      <details className="group/table" key={refKey(classEntry.ref)} onToggle={showCurrentRow}>
        <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-brand-soft hover:text-white">
          <ChevronDown size={16} aria-hidden="true" className="transition-transform group-open/table:rotate-180" />
          Rasgos de clase
        </summary>
        <div className="mt-2">
          <ClassTable data={data} classLevel={classLevel} entry={entry} />
        </div>
      </details>
    </div>
  );

  if (collapsible) {
    return (
      <details className="group/card rounded-lg border border-line bg-panel p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          {heading}
          <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-muted transition-transform group-open/card:rotate-180" />
        </summary>
        {body}
      </details>
    );
  }
  return (
    <section aria-label={`Nuevo nivel: ${name}`} className="animate-fade-up rounded-lg border border-line bg-panel p-5">
      {heading}
      {body}
    </section>
  );
}
