"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { inventoryHref } from "@/lib/rules/dnd2024/sheet/inventoryTable";
import { field } from "@/app/components/ui/formStyles";
import SectionChips from "./SectionChips";

type Query = Record<string, string | string[] | undefined>;

// Búsqueda y chips de la pestaña Inventario. La búsqueda vive en `?q=` y espera 300 ms antes de cambiar la URL (como la
// tabla de conjuros); los chips son enlaces con `?seccion=`. Nada de esto se imprime.
export default function InventoryFilters({ base, query, chips, active, q: urlQ }: {
  base: string;
  query: Query;
  chips: { id: string; label: string }[];
  active: string;
  /** Búsqueda que viene de la URL. */
  q: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(urlQ);
  // Si la URL trae otra búsqueda que la ya enviada (p. ej. al navegar atrás), se adopta; la propia no pisa lo que se escribe
  const [sent, setSent] = useState(urlQ);
  const [seen, setSeen] = useState(urlQ);
  if (seen !== urlQ) {
    setSeen(urlQ);
    if (urlQ !== sent) {
      setQ(urlQ);
      setSent(urlQ);
    }
  }
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function onSearch(value: string) {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSent(value.trim());
      router.replace(`${base}${inventoryHref(query, { q: value })}`, { scroll: false });
    }, 300);
  }

  return (
    <div className="space-y-3 print:hidden">
      <div className="relative">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Buscar en el inventario"
          placeholder="Buscar por nombre, tipo, rareza o propiedades"
          className={`${field} pl-9`}
        />
      </div>
      <SectionChips chips={chips} active={active} base={base} query={query} label="Filtrar inventario" />
    </div>
  );
}
