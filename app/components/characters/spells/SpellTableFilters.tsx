"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { spellTableHref, type SpellTableFilter, type Tri } from "@/lib/rules/dnd2024/spells/spellTableFilter";
import { field } from "@/app/components/ui/formStyles";

type Query = Record<string, string | string[] | undefined>;

const chip = (on: boolean) =>
  `shrink-0 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
    on ? "border-brand bg-brand text-white" : "border-line text-muted hover:text-white"
  }`;

const KINDS: { id: SpellTableFilter["kind"]; label: string }[] = [
  { id: "all", label: "Todo" }, { id: "cantrips", label: "Trucos" }, { id: "spells", label: "Conjuros" },
];
const TRI_OPTIONS: { id: Tri; label: string }[] = [
  { id: "any", label: "cualquiera" }, { id: "yes", label: "sí" }, { id: "no", label: "no" },
];

// Búsqueda, chips y selectores de la tabla de conjuros (spec de la tabla de conjuros §3.1): todo vive en la URL
// (`?q=&tipo=&nivel=&conc=&ritual=`), así que se puede compartir. La búsqueda espera 300 ms antes de cambiarla; los
// chips son enlaces. En móvil se apilan y los chips se desplazan en horizontal.
export default function SpellTableFilters({ base, query, filter, levels }: {
  base: string;
  query: Query;
  filter: SpellTableFilter;
  /** Niveles (1–9) que tienen conjuros. */
  levels: number[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(filter.q);
  // Último valor ya enviado a la URL y último que llegó de ella: si llega otro (p. ej. «Quitar filtros»), se adopta;
  // si es el propio, no se pisa lo que se siga escribiendo
  const [sent, setSent] = useState(filter.q);
  const [seen, setSeen] = useState(filter.q);
  if (seen !== filter.q) {
    setSeen(filter.q);
    if (filter.q !== sent) {
      setQ(filter.q);
      setSent(filter.q);
    }
  }
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Los enlaces y selectores llevan también lo tecleado y anulan la espera pendiente, para que ni uno ni otro deshagan
  // el cambio del otro
  const withQ = (patch: Partial<SpellTableFilter>): Partial<SpellTableFilter> => ({ q, ...patch });
  const href = (patch: Partial<SpellTableFilter>) => `${base}${spellTableHref(query, withQ(patch))}`;
  const flush = () => {
    clearTimeout(timer.current);
    setSent(q.trim());
  };
  const go = (patch: Partial<SpellTableFilter>) => {
    flush();
    router.replace(href(patch), { scroll: false });
  };

  function onSearch(value: string) {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSent(value.trim());
      router.replace(`${base}${spellTableHref(query, { q: value })}`, { scroll: false });
    }, 300);
  }

  const toggleLevel = (n: number) =>
    filter.levels.includes(n) ? filter.levels.filter((l) => l !== n) : [...filter.levels, n];

  return (
    <div className="mb-4 space-y-3 print:hidden">
      <div className="relative">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Buscar conjuros"
          placeholder="Buscar por nombre, daño, estado o tiempo"
          className={`${field} pl-9`}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <nav aria-label="Filtrar por tipo" className="flex gap-2">
            {KINDS.map((k) => (
              <Link
                key={k.id}
                href={href({ kind: k.id })}
                scroll={false}
                onClick={flush}
                aria-current={k.id === filter.kind ? "page" : undefined}
                className={chip(k.id === filter.kind)}
              >
                {k.label}
              </Link>
            ))}
          </nav>
          {levels.length > 0 && (
            <nav aria-label="Filtrar por nivel" className="flex gap-2 border-l border-line pl-2">
              {levels.map((n) => {
                const on = filter.levels.includes(n);
                return (
                  <Link
                    key={n}
                    href={href({ levels: toggleLevel(n) })}
                    scroll={false}
                    onClick={flush}
                    aria-current={on ? "page" : undefined}
                    aria-label={`Nivel ${n}`}
                    title={`Nivel ${n}`}
                    className={chip(on)}
                  >
                    {n}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {([["concentration", "Concentración"], ["ritual", "Ritual"]] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <span className="text-muted">{label}:</span>
              <select
                value={filter[key]}
                onChange={(e) => go({ [key]: e.target.value as Tri })}
                className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-fg focus:border-brand focus:outline-none"
              >
                {TRI_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
