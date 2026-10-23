"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { EntryOption } from "@/lib/rules/catalog";
import type { Ref } from "@/lib/rules/types";
import { normalizeName } from "@/lib/rules/schemas";
import { field, labelClass } from "../formStyles";
import useDismiss from "../useDismiss";

const sameRef = (a: Ref | null, b: Ref) => !!a && a.book === b.book && a.key === b.key;
const displayName = (o: EntryOption) => o.nameEs ?? o.name;

// Desplegable con búsqueda (combobox accesible) para elegir una entrada de reglas
export default function RuleSelect({
  id, label, options, value, onChange, disabled, placeholder = "Selecciona una opción",
}: {
  id: string;
  label: string;
  options: EntryOption[];
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

  const selected = options.find((o) => sameRef(value, o.ref)) ?? null;
  const filtered = useMemo(() => {
    const q = normalizeName(query.trim());
    if (!q) return options;
    return options.filter((o) => normalizeName(displayName(o)).includes(q) || normalizeName(o.name).includes(q));
  }, [options, query]);

  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  function close() {
    setOpen(false);
    setQuery("");
  }
  useDismiss(box, open, close);

  function openList() {
    if (disabled) return;
    const i = filtered.findIndex((o) => sameRef(value, o.ref));
    setActive(i >= 0 ? i : 0);
    setOpen(true);
  }

  function choose(o: EntryOption) {
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
    } else if (e.key === "Tab") {
      close();
    }
  }

  return (
    <div ref={box} className="relative">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <div className="relative">
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
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="animate-pop absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-line bg-panel py-1 shadow-lg"
        >
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-muted">Sin resultados</li>}
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
                {displayName(o)} <span className="text-muted">· {o.bookName}</span>
              </span>
              {o.srd52 && (
                <span className="rounded border border-line px-1.5 text-[10px] font-bold text-muted" title="Incluido en el SRD 5.2">
                  SRD
                </span>
              )}
              {sameRef(value, o.ref) && <Check size={14} aria-hidden="true" className="text-brand-soft" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
