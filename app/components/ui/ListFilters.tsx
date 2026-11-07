"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { field } from "@/app/components/ui/formStyles";

export type FilterSelect = {
  /** Nombre del parámetro de la URL. */
  name: string;
  label: string;
  /** Valor que viene de la URL (ya validado por la página). */
  value: string;
  /** Valor por defecto: no se escribe en la URL. */
  defaultValue: string;
  options: { value: string; label: string }[];
};

// Buscador de las listas (personajes, campañas): `?q=` espera 300 ms tras teclear y los selectores aplican al cambiar.
// Cualquier cambio de filtro vuelve a la primera página (se quita `page`).
export default function ListFilters({ base, title, q: urlQ, searchLabel, placeholder, selects, className }: {
  base: string;
  title: string;
  /** Búsqueda que viene de la URL. */
  q: string;
  searchLabel: string;
  placeholder: string;
  selects: FilterSelect[];
  className?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(urlQ);
  // Hay una búsqueda tecleada que aún no se ha enviado a la URL
  const [typing, setTyping] = useState(false);
  const urlValues = Object.fromEntries(selects.map((s) => [s.name, s.value]));
  const urlKey = JSON.stringify([urlQ, urlValues]);
  const [vals, setVals] = useState<Record<string, string>>(urlValues);
  // Si la URL trae otros filtros (al navegar atrás o al pulsar «Limpiar»), se adoptan, salvo mientras se está escribiendo
  const [seen, setSeen] = useState(urlKey);
  if (seen !== urlKey) {
    setSeen(urlKey);
    setVals(urlValues);
    if (!typing && urlQ !== q.trim()) setQ(urlQ);
  }
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Parte de la URL del momento (no de la del render), para no pisar un selector cambiado durante la espera
  function apply(changes: Record<string, { value: string; defaultValue: string }>) {
    const params = new URLSearchParams(window.location.search);
    for (const [name, { value, defaultValue }] of Object.entries(changes)) {
      if (value === defaultValue) params.delete(name);
      else params.set(name, value);
    }
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${base}?${qs}` : base, { scroll: false });
  }

  function onSearch(value: string) {
    setQ(value);
    setTyping(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setTyping(false);
      apply({ q: { value: value.trim(), defaultValue: "" } });
    }, 300);
  }

  function onSelect(s: FilterSelect, value: string) {
    setVals((v) => ({ ...v, [s.name]: value }));
    apply({ [s.name]: { value, defaultValue: s.defaultValue } });
  }

  const hasFilters = urlQ !== "" || selects.some((s) => s.value !== s.defaultValue);
  return (
    <div className={className}>
      <h2 className="mb-4 font-heading text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          maxLength={80}
          placeholder={placeholder}
          aria-label={searchLabel}
          className={`${field} h-11 min-w-0 flex-[2_1_14rem]`}
        />
        {selects.map((s) => (
          <select
            key={s.name}
            value={vals[s.name] ?? s.value}
            onChange={(e) => onSelect(s, e.target.value)}
            aria-label={s.label}
            className={`${field} h-11 min-w-0 flex-[1_1_9rem]`}
          >
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ))}
        {hasFilters && (
          <Link href={base} className="text-sm text-muted hover:text-white">
            Limpiar
          </Link>
        )}
      </div>
    </div>
  );
}
