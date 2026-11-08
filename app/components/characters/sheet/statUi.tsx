import { ABILITY_ABBR } from "@/lib/rules/dnd2024/sheet/labels";
import type { Ability } from "@/lib/rules/types";

// «CAR» → «Car», para el título de una habilidad: «Engaño (Car)»
export const abbr = (a: Ability) => ABILITY_ABBR[a][0] + ABILITY_ABBR[a].slice(1).toLowerCase();

// Valores que abren su detalle: el área entera se puede pulsar, sin parecer un botón de acción. Al imprimir se ven
// como texto (`data-print`, ver globals.css)
export const statButton =
  "cursor-pointer transition-colors hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand";
// Caja de la ficha, su título y sus piezas (etiquetas, recuadros, rótulos pequeños)
export const sheetBox = "rounded-xl border border-line bg-panel";
export const sheetSideBox = "rounded-xl border border-line bg-panel p-3";
export const boxTitle = "font-heading text-sm font-extrabold uppercase tracking-wide text-brand-soft";
export const subLabel = "mb-1 text-xs font-semibold text-muted";
export const abbrChip = "shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] font-bold text-fg";
export const tagChip = "rounded bg-surface px-1.5 py-0.5 text-xs font-medium text-fg";
export const fieldBox = "flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-line p-1";
// Interruptor (casilla nativa con forma de palanca): para equipar objetos
export const switchTrack = "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-line transition-colors has-checked:bg-brand has-disabled:cursor-not-allowed has-disabled:opacity-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-soft";
export const switchThumb = "pointer-events-none absolute left-0.5 h-4 w-4 rounded-full bg-fg transition-transform peer-checked:translate-x-4";

/** Texto llano de una descripción (sin etiquetas BBCode), para el resumen de dos líneas de las filas. */
export const plainText = (source: string) => source.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();

// Barra de sección de las pestañas: título a la izquierda y, a la derecha, las columnas o los controles
export function SectionBar({ title, lead, extra, children }: { title: string; lead?: React.ReactNode; extra?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-surface px-3 py-1.5">
      {lead}
      <h3 className={boxTitle}>{title}</h3>
      {extra && <span className="text-xs text-muted">{extra}</span>}
      {children && <div className="ml-auto flex items-center gap-3 text-xs font-medium text-fg">{children}</div>}
    </div>
  );
}

export const chip = "flex h-14 flex-col items-center justify-center rounded-md border border-line bg-surface px-2 text-center";
export const chipLabel = "flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted";
export const chipValue = "font-heading text-xl font-extrabold leading-tight";

// Marca de competencia, un solo marcador: sin competencia = anillo atenuado, competencia = punto relleno,
// pericia = punto relleno dentro de un anillo (círculo dentro de círculo)
export function ProficiencyDot({ level }: { level: 0 | 1 | 2 }) {
  const label = level === 2 ? "Pericia" : level === 1 ? "Competencia" : "Sin competencia";
  return (
    <span
      title={label}
      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
        level === 0 ? "border-muted/50" : level === 1 ? "border-brand bg-brand" : "border-brand"
      }`}
    >
      {level === 2 && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
      <span className="sr-only">{label}</span>
    </span>
  );
}
