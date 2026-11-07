"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Funnel, Search, SearchX, X } from "lucide-react";
import type { EntryOption } from "@/lib/rules/catalog/types";
import type { Ref } from "@/lib/rules/types";
import { bareName } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { classFacets, filterGroups, matchesFilters, matchesSearch, speciesFacets, toggleFilter, type FilterState } from "@/lib/rules/dnd2024/optionFilters";
import RoundIcon from "../../ui/RoundIcon";
import useDismiss from "../../ui/useDismiss";

const sameRef = (a: Ref | null, b: Ref) => !!a && a.book === b.book && a.key === b.key;

/* Elección de clase o especie en tarjetas con su icono (botones de opción nativos: flechas del teclado y lector de
   pantalla incluidos), con buscador y filtros. El `id` va en la opción que recibe el foco, para los enlaces de «Falta por
   completar». */
export default function OptionCards({ id, label, kind, options, lineages, value, onChange }: {
  id: string;
  label: string;
  kind: "class" | "species";
  options: EntryOption[];
  /** Legados por "libro:clave" de la especie: su magia y sus resistencias cuentan para los filtros. */
  lineages?: Record<string, EntryOption[]>;
  value: Ref | null;
  onChange: (ref: Ref) => void;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({});
  const [panel, setPanel] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, panel, () => setPanel(false));

  const rows = useMemo(() => options.map((option) => ({
    option,
    facets: kind === "species" ? speciesFacets(option, lineages?.[`${option.ref.book}:${option.ref.key}`]) : classFacets(option),
  })), [options, lineages, kind]);
  const groups = useMemo(() => filterGroups(kind, rows.map((r) => r.facets)), [kind, rows]);
  const visible = rows.filter((r) => matchesSearch(r.option, query) && matchesFilters(r.facets, filters)).map((r) => r.option);

  const active = groups.flatMap((g) => g.options.filter((o) => filters[g.id]?.includes(o.id)).map((o) => ({ group: g.id, ...o })));
  const clear = () => {
    setQuery("");
    setFilters({});
  };
  const focusIndex = Math.max(visible.findIndex((o) => sameRef(value, o.ref)), 0);

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      {options.length === 0 ? <p className="text-sm text-muted">No hay opciones disponibles con los libros elegidos.</p> : (
        <div ref={box} className="relative mb-3">
          <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface pl-3 pr-1.5 transition-colors focus-within:border-brand">
            <Search size={16} aria-hidden="true" className="shrink-0 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // Dentro del formulario del creador: Intro no debe enviarlo
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              placeholder={kind === "species" ? "Buscar especie" : "Buscar clase"}
              aria-label={kind === "species" ? "Buscar especie" : "Buscar clase"}
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-fg placeholder:text-muted focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
            />
            {groups.length > 0 && (
              <button
                type="button"
                aria-expanded={panel}
                aria-label={active.length ? `Filtros (${active.length} activos)` : "Filtros"}
                title="Filtros"
                onClick={() => setPanel((p) => !p)}
                className={`relative my-1 flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-line ${active.length || panel ? "text-brand-soft" : "text-fg"}`}
              >
                <Funnel size={16} aria-hidden="true" className={active.length ? "fill-current" : ""} />
                {active.length > 0 && (
                  <span aria-hidden="true" className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">{active.length}</span>
                )}
              </button>
            )}
          </div>

          {panel && (
            <div className="absolute right-0 top-full z-30 mt-1 max-h-[26rem] w-full max-w-xs animate-pop overflow-y-auto rounded-xl border border-brand/60 bg-panel p-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilters({})}
                  disabled={active.length === 0}
                  className="flex-1 rounded-md border border-brand/60 py-1.5 text-sm font-semibold text-fg transition-colors enabled:hover:bg-brand/15 disabled:border-line disabled:text-muted"
                >
                  Limpiar filtros
                </button>
                <button type="button" aria-label="Cerrar filtros" onClick={() => setPanel(false)} className="rounded-md p-1.5 text-muted transition-colors hover:text-white">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <ul className="space-y-1.5">
                {groups.map((g) => {
                  const open = openGroup === g.id;
                  const count = filters[g.id]?.length ?? 0;
                  return (
                    <li key={g.id} className="rounded-md bg-surface">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpenGroup(open ? null : g.id)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold text-fg"
                      >
                        <span className="min-w-0">{g.label}{count > 0 && <span className="ml-1.5 text-brand-soft">({count})</span>}</span>
                        <ChevronDown size={16} aria-hidden="true" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                      </button>
                      {open && (
                        <div className="space-y-0.5 px-3 pb-2">
                          {g.options.map((o) => (
                            <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded py-1 text-sm text-fg">
                              <input
                                type="checkbox"
                                checked={!!filters[g.id]?.includes(o.id)}
                                onChange={() => setFilters((f) => toggleFilter(f, g.id, o.id))}
                                className="size-4 shrink-0 accent-brand"
                              />
                              <span className="min-w-0">{o.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {active.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {active.map((a) => (
                <li key={`${a.group}:${a.id}`}>
                  <button
                    type="button"
                    aria-label={`Quitar filtro ${a.label}`}
                    onClick={() => setFilters((f) => toggleFilter(f, a.group, a.id))}
                    className="flex items-center gap-1 rounded-full border border-line-strong bg-surface py-0.5 pl-2.5 pr-1.5 text-xs font-semibold text-fg transition-colors hover:border-brand"
                  >
                    {a.label} <X size={12} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p aria-live="polite" className="mt-2 text-xs text-muted">{visible.length} de {options.length}</p>
        </div>
      )}

      {options.length > 0 && visible.length === 0 && (
        <p className="flex flex-wrap items-center gap-2 py-3 text-sm text-muted">
          <SearchX size={16} aria-hidden="true" /> Ninguna coincide.
          <button type="button" onClick={clear} className="font-semibold text-brand-soft hover:underline">Quitar búsqueda y filtros</button>
        </p>
      )}
      {/* Con muchos libros la lista es larga: se desplaza por dentro para no alejar lo que viene después */}
      <div className="-m-1 grid max-h-[30rem] gap-2.5 overflow-y-auto p-1 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((o, i) => {
          const selected = sameRef(value, o.ref);
          const name = o.nameEs ?? o.name;
          return (
            <label
              key={`${o.ref.book}:${o.ref.key}`}
              className={`relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-soft ${
                selected ? "border-brand bg-brand/10" : "border-line bg-surface/40 hover:border-line-strong hover:bg-surface"
              }`}
            >
              <input
                id={i === focusIndex ? id : undefined}
                type="radio"
                name={id}
                checked={selected}
                onChange={() => onChange(o.ref)}
                className="sr-only"
              />
              <RoundIcon kind={kind} id={bareName(o.ref.key)} label={name} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-heading text-sm font-bold text-white">{name}</span>
                {o.bookName && <span className="block truncate text-xs text-muted">{o.bookName}</span>}
              </span>
              {selected && <Check size={16} strokeWidth={3} aria-hidden="true" className="shrink-0 text-brand-soft" />}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
