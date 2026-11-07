"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { normalizeName } from "@/lib/rules/schemas";
import { field } from "@/app/components/ui/formStyles";

const norm = (s: string) => normalizeName(s.trim());

// Buscador de una pestaña cuyas filas pinta el servidor: marca con `data-filtered` las filas (`data-search`) que no
// coinciden y los grupos (`data-search-group`) que se quedan sin ninguna. Solo se ocultan en pantalla (ver globals.css): la
// hoja impresa sale completa.
export default function PanelSearch({ label }: { label: string }) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const root = input.current?.closest("section");
    if (!root) return;
    const wanted = norm(q);
    root.querySelectorAll<HTMLElement>("[data-search]").forEach((el) => {
      el.toggleAttribute("data-filtered", !!wanted && !norm(el.dataset.search ?? "").includes(wanted));
    });
    root.querySelectorAll<HTMLElement>("[data-search-group]").forEach((group) => {
      const rows = [...group.querySelectorAll<HTMLElement>("[data-search]")];
      group.toggleAttribute("data-filtered", !!wanted && rows.every((r) => r.hasAttribute("data-filtered")));
    });
  }, [q]);
  return (
    <div className="relative min-w-0 flex-1 basis-48 print:hidden">
      <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        ref={input}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={label}
        placeholder="Buscar…"
        className={`${field} py-2! pl-9 text-sm`}
      />
    </div>
  );
}
