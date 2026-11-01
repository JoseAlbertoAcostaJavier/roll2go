import { ABILITY_ABBR } from "@/lib/rules/dnd2024/sheet/labels";
import type { Ability } from "@/lib/rules/types";

// «CAR» → «Car», para el título de una habilidad: «Engaño (Car)»
export const abbr = (a: Ability) => ABILITY_ABBR[a][0] + ABILITY_ABBR[a].slice(1).toLowerCase();

// Valores que abren su detalle: el área entera se puede pulsar, sin parecer un botón de acción. Al imprimir se ven
// como texto (`data-print`, ver globals.css)
export const statButton =
  "cursor-pointer transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand";
export const chip = "flex h-14 flex-col items-center justify-center rounded-md border border-line bg-surface px-2 text-center";
export const chipLabel = "flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted";
export const chipValue = "font-heading text-xl font-extrabold leading-tight";

// Marca de competencia: vacía, competencia o pericia (doble)
export function ProficiencyDot({ level }: { level: 0 | 1 | 2 }) {
  const label = level === 2 ? "Pericia" : level === 1 ? "Competencia" : "Sin competencia";
  return (
    <span title={label} className="flex shrink-0 items-center gap-0.5">
      <span className={`h-2.5 w-2.5 rounded-full border ${level > 0 ? "border-brand bg-brand" : "border-muted"}`} />
      {level === 2 && <span className="h-2.5 w-2.5 rounded-full border border-brand bg-brand" />}
      <span className="sr-only">{label}</span>
    </span>
  );
}
