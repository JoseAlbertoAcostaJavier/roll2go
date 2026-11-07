export const field =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2.5 text-fg placeholder:text-muted focus:border-brand focus:outline-none disabled:opacity-60";
export const labelClass = "mb-1.5 block text-sm font-semibold";
export const card = "rounded-lg border border-line bg-panel p-5 sm:p-6";
/** Caja de la ficha visual: borde neutro; la marca queda en la barra roja de los títulos. */
export const sheetCard = "rounded-xl border border-line bg-panel p-4 sm:p-6";
export const cardTitle =
  "mb-4 border-l-4 border-brand pl-3 font-heading text-xl font-bold";
export const primaryButton =
  "flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 font-heading font-bold text-white transition-colors not-disabled:hover:bg-brand-hover disabled:opacity-50";
/** Acción secundaria (buscar, enviar mensaje): sin rojo, para que el rojo señale solo la acción principal. */
export const secondaryButton =
  "flex items-center justify-center gap-2 rounded-md border border-line-strong bg-panel px-5 py-2.5 font-heading font-bold text-fg transition-colors not-disabled:hover:border-fg disabled:opacity-50";
/** Variante compacta de `secondaryButton` para las acciones en línea. */
export const secondaryButtonSm =
  "flex items-center gap-1.5 rounded-md border border-line-strong bg-panel px-3 py-1.5 text-sm font-semibold text-fg transition-colors hover:border-fg disabled:hover:border-line-strong disabled:opacity-50";
export const errorClass = "mt-1 text-xs text-danger";
export const successClass = "text-sm text-success";
