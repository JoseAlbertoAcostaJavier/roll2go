import Link from "next/link";
import PanelSearch from "./PanelSearch";
import { ACTION_FILTERS, actionFilterHref, type ActionFilter } from "@/lib/rules/dnd2024/sheet/actionFilters";

type Query = Record<string, string | string[] | undefined>;

const chip = (on: boolean) =>
  `shrink-0 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
    on ? "border-brand bg-brand text-white" : "border-line text-muted hover:text-white"
  }`;

// Chips de filtro de la pestaña Acciones (spec de acciones §4): enlaces con `?filtro=`, para poder compartirlos; en
// móvil se desplazan en horizontal dentro de su fila
export default function ActionsFilters({ base, query, active }: { base: string; query: Query; active: ActionFilter }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
    <PanelSearch label="Buscar en combate" />
    <nav aria-label="Filtrar acciones" className="flex gap-1.5 overflow-x-auto pb-0.5">
      {ACTION_FILTERS.map((f) => (
        <Link
          key={f.id}
          href={`${base}${actionFilterHref(query, f.id)}`}
          scroll={false}
          aria-current={f.id === active ? "page" : undefined}
          className={chip(f.id === active)}
        >
          {f.label}
        </Link>
      ))}
    </nav>
    </div>
  );
}
