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
  // Hay una búsqueda tecleada que aún no se ha enviado a la URL
  const [typing, setTyping] = useState(false);
  // Si la URL trae otra búsqueda (p. ej. al navegar atrás), se adopta, salvo mientras se está escribiendo
  const [seen, setSeen] = useState(urlQ);
  if (seen !== urlQ) {
    setSeen(urlQ);
    if (!typing && urlQ !== q.trim()) setQ(urlQ);
  }
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Lo último que dijo la URL, para que la espera no pise un chip pulsado entretanto
  const latest = useRef(query);
  useEffect(() => {
    latest.current = query;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  function onSearch(value: string) {
    setQ(value);
    setTyping(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setTyping(false);
      router.replace(`${base}${inventoryHref(latest.current, { q: value })}`, { scroll: false });
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
