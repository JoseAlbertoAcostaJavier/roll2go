"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import type { EntryOption } from "@/lib/rules/catalog";
import type { Ref } from "@/lib/rules/types";
import { normalizeName } from "@/lib/rules/schemas";
import { field, labelClass } from "../formStyles";
import useDismiss from "../useDismiss";

const sameRef = (a: Ref | null, b: Ref) => !!a && a.book === b.book && a.key === b.key;
const displayName = (o: EntryOption) => o.nameEs ?? o.name;
// Espera tras la última tecla antes de buscar en el servidor
const SEARCH_DELAY = 250;
// Alto máximo de la lista (max-h-64) y separación con el campo
const LIST_MAX = 256;
const GAP = 4;

type Place = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

// Coloca la lista bajo el campo, o encima si no cabe debajo y arriba hay más sitio
function placeFor(el: HTMLElement): Place {
  const r = el.getBoundingClientRect();
  const below = window.innerHeight - r.bottom - GAP * 2;
  const above = r.top - GAP * 2;
  const up = below < Math.min(LIST_MAX, 160) && above > below;
  const maxHeight = Math.max(Math.min(LIST_MAX, up ? above : below), 96);
  return up
    ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + GAP, maxHeight }
    : { left: r.left, width: r.width, top: r.bottom + GAP, maxHeight };
}

/* Desplegable con búsqueda (combobox accesible) para elegir una entrada de reglas. Con `loadOptions` la búsqueda
   se hace en remoto (con espera) en vez de filtrar `options` en local. */
export default function RuleSelect({
  id, label, options, value, onChange, disabled, placeholder = "Selecciona una opción", loadOptions,
}: {
  id: string;
  label: string;
  options: EntryOption[];
  loadOptions?: (q: string) => Promise<EntryOption[]>;
  value: Ref | null;
  onChange: (ref: Ref | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [place, setPlace] = useState<Place | null>(null);

  // La lista se pinta en un portal con posición fija: así ninguna sección animada (que crea su propio contexto de
  // apilamiento) la tapa. Sigue al campo al desplazar o cambiar el tamaño de la ventana.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => anchor.current && setPlace(placeFor(anchor.current));
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Búsqueda remota: resultado de la última consulta y la entrada elegida (ya no está en `options`)
  const [remote, setRemote] = useState<{ q: string; list: EntryOption[]; failed: boolean } | null>(null);
  const [picked, setPicked] = useState<EntryOption | null>(null);

  useEffect(() => {
    if (!open || !loadOptions) return;
    let stale = false;
    const t = setTimeout(() => {
      loadOptions(query.trim())
        .then((list) => ({ list, failed: false }))
        .catch(() => ({ list: [] as EntryOption[], failed: true }))
        .then((r) => {
          if (stale) return;
          setRemote({ q: query, ...r });
          setActive(0);
        });
    }, SEARCH_DELAY);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [open, query, loadOptions]);

  const loading = !!loadOptions && open && remote?.q !== query;
  const selected = options.find((o) => sameRef(value, o.ref)) ?? (picked && sameRef(value, picked.ref) ? picked : null);
  const filtered = useMemo(() => {
    if (loadOptions) return remote?.list ?? [];
    const q = normalizeName(query.trim());
    if (!q) return options;
    return options.filter((o) => normalizeName(displayName(o)).includes(q) || normalizeName(o.name).includes(q));
  }, [options, query, loadOptions, remote]);

  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  function close() {
    setOpen(false);
    setQuery("");
  }
  useDismiss(box, open, close, listRef);

  function openList() {
    if (disabled) return;
    const i = filtered.findIndex((o) => sameRef(value, o.ref));
    setActive(i >= 0 ? i : 0);
    setOpen(true);
  }

  function choose(o: EntryOption) {
    setPicked(o);
    onChange(o.ref);
    close();
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openList();
      else setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) openList();
      else setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (e.key === "Home" && open) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && open) {
      e.preventDefault();
      setActive(Math.max(filtered.length - 1, 0));
    } else if (e.key === "Escape" && open) {
      // Cierra solo la lista: que el diálogo que la contiene no lo vea como un Escape propio
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      close();
    }
  }

  return (
    <div ref={box} className="relative">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <div ref={anchor} className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? optionId(active) : undefined}
          autoComplete="off"
          disabled={disabled}
          className={`${field} pr-9`}
          placeholder={selected ? displayName(selected) : placeholder}
          value={open ? query : selected ? displayName(selected) : ""}
          onFocus={openList}
          onClick={openList}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>
      {open && place && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}
          className="animate-pop fixed z-[60] overflow-y-auto rounded-md border border-line bg-panel py-1 shadow-lg"
        >
          {loading && filtered.length === 0 && <li className="px-3 py-2 text-sm text-muted">Buscando…</li>}
          {!loading && filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">
              {loadOptions && remote?.failed ? "No se pudo buscar. Inténtalo de nuevo." : "Sin resultados"}
            </li>
          )}
          {filtered.map((o, i) => (
            <li
              key={`${o.ref.book}:${o.ref.key}`}
              id={optionId(i)}
              role="option"
              aria-selected={sameRef(value, o.ref)}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${i === active ? "bg-surface" : ""}`}
            >
              <span className="min-w-0 flex-1 truncate">
                {displayName(o)} {o.bookName && <span className="text-muted">· {o.bookName}</span>}
              </span>
              {o.srd52 && (
                <span className="rounded border border-line px-1.5 text-[10px] font-bold text-muted" title="Incluido en el SRD 5.2">
                  SRD
                </span>
              )}
              {sameRef(value, o.ref) && <Check size={14} aria-hidden="true" className="text-brand-soft" />}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
