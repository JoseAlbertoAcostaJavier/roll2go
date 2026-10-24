"use client";

import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { EMPTY_SPELL_FILTER, type SpellFilter } from "@/lib/rules/dnd2024/spellFilters";
import { spellSchoolName } from "@/lib/rules/dnd2024/spellText";
import { field } from "@/app/components/formStyles";
import useDismiss from "@/app/components/useDismiss";

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const SCHOOLS = ["A", "C", "D", "E", "V", "I", "N", "T"];

const chip = (on: boolean) =>
  `rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
    on ? "border-brand bg-brand text-white" : "border-line text-muted hover:text-white"
  }`;

// Desplegable de etiquetas con selección múltiple (lista de casillas)
function TagSelect({ id, tags, value, onChange }: {
  id: string; tags: string[]; value: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(box, open, close);
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);

  return (
    <div ref={box} className="relative min-w-0 flex-1 basis-48">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => setOpen((o) => !o)}
        className={`${field} flex items-center gap-2 text-left`}
      >
        <span className={`min-w-0 flex-1 truncate ${value.length ? "" : "text-muted"}`}>
          {value.length ? `Etiquetas (${value.length})` : "Etiquetas"}
        </span>
        <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          id={`${id}-list`}
          aria-label="Etiquetas"
          className="animate-pop absolute z-30 mt-1 max-h-64 w-full min-w-56 overflow-y-auto rounded-md border border-line bg-panel py-1 shadow-lg"
        >
          {tags.length === 0 && <li className="px-3 py-2 text-sm text-muted">Sin etiquetas</li>}
          {tags.map((t) => (
            <li key={t}>
              <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-surface">
                <input type="checkbox" className="accent-brand" checked={value.includes(t)} onChange={() => toggle(t)} />
                <span className="min-w-0 flex-1">{t}</span>
                {value.includes(t) && <Check size={14} aria-hidden="true" className="text-brand-soft" />}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Filtros de las listas Disponibles y Todos: nombre, Trucos y niveles 1–9, escuela y etiquetas (tiene que tenerlas
// todas). `tags`: las etiquetas de la lista.
export default function SpellFilters({ id, value, onChange, tags, maxLevel = 9 }: {
  id: string;
  value: SpellFilter;
  onChange: (v: SpellFilter) => void;
  tags: string[];
  /** Nivel más alto que se ofrece en las casillas. */
  maxLevel?: number;
}) {
  const set = (patch: Partial<SpellFilter>) => onChange({ ...value, ...patch });
  const toggleLevel = (l: number) =>
    set({ levels: value.levels.includes(l) ? value.levels.filter((x) => x !== l) : [...value.levels, l] });
  const active = value.name || value.levels.length || value.school || value.tags.length;

  return (
    <div className="mb-4 space-y-3 print:hidden" role="search" aria-label="Filtrar conjuros">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-[2_1_14rem]">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id={`${id}-name`}
            type="search"
            aria-label="Nombre"
            placeholder="Buscar por nombre"
            className={`${field} pl-9`}
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
        <select
          id={`${id}-school`}
          aria-label="Escuela"
          className={`${field} min-w-0 flex-1 basis-40`}
          value={value.school}
          onChange={(e) => set({ school: e.target.value })}
        >
          <option value="">Todas las escuelas</option>
          {SCHOOLS.map((s) => <option key={s} value={s}>{spellSchoolName(s)}</option>)}
        </select>
        <TagSelect id={`${id}-tags`} tags={tags} value={value.tags} onChange={(t) => set({ tags: t })} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Nivel">
        {LEVELS.filter((l) => l <= maxLevel).map((l) => (
          <button key={l} type="button" aria-pressed={value.levels.includes(l)} onClick={() => toggleLevel(l)} className={chip(value.levels.includes(l))}>
            {l === 0 ? "Trucos" : `Nivel ${l}`}
          </button>
        ))}
        {value.tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => set({ tags: value.tags.filter((x) => x !== t) })}
            className="flex animate-pop items-center gap-1 rounded-md border border-brand-soft/50 px-2 py-1 text-xs text-brand-soft hover:text-white"
            aria-label={`Quitar la etiqueta ${t}`}
          >
            {t} <X size={12} aria-hidden="true" />
          </button>
        ))}
        {active ? (
          <button type="button" onClick={() => onChange(EMPTY_SPELL_FILTER)} className="ml-auto px-2 py-1 text-xs font-semibold text-muted hover:text-white">
            Quitar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}
