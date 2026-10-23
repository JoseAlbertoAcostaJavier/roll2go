"use client";

import { useMemo } from "react";
import { CircleCheck, LoaderCircle } from "lucide-react";
import type { CatalogEntry } from "@/lib/rules/catalog";
import { derive } from "@/lib/rules/dnd2024/derive";
import type { Dnd2024Sheet } from "@/lib/rules/dnd2024/sheet";

export type MissingItem = { label: string; href: string };

const fmtMod = (m: number) => (m > 0 ? `+${m}` : m < 0 ? `−${-m}` : "+0");

/* Resumen lateral del asistente: valores derivados de lo elegido hasta ahora y lo que falta por completar.
   `entries` son las entradas del catálogo ya cargadas, por "libro:clave". */
export default function CharacterSummary({
  sheet, entries, hasSpecies, hasClass, equipmentLoading, missing,
}: {
  sheet: Dnd2024Sheet;
  entries: Map<string, CatalogEntry>;
  hasSpecies: boolean;
  hasClass: boolean;
  /** Mientras se cargan los objetos del equipo, la CA se calcula sin armadura. */
  equipmentLoading: boolean;
  missing: MissingItem[];
}) {
  const d = useMemo(() => derive(sheet, entries), [sheet, entries]);

  const stats: { label: string; value: string }[] = [
    { label: "PG", value: hasClass ? String(d.hpMax) : "—" },
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

      <h3 className="mb-2 mt-5 text-sm font-semibold">Falta por completar</h3>
      {missing.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <CircleCheck size={16} aria-hidden="true" /> ¡Todo listo!
        </p>
      ) : (
        <ul className="space-y-1 text-sm">
          {missing.map((m) => (
            <li key={m.label}>
              <a href={m.href} className="text-brand-soft hover:underline">{m.label}</a>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
