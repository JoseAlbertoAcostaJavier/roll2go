"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Backpack, BookUser, NotebookPen, Sparkles, Swords, WandSparkles } from "lucide-react";
import type { SheetTabId } from "@/lib/rules/dnd2024/sheet/sheetTabs";

export const SHEET_TABS = [
  { id: "acciones", label: "Acciones", icon: Swords },
  { id: "conjuros", label: "Conjuros", icon: WandSparkles },
  { id: "inventario", label: "Inventario", icon: Backpack },
  { id: "rasgos", label: "Rasgos y dotes", icon: Sparkles },
  { id: "trasfondo", label: "Trasfondo", icon: BookUser },
  { id: "notas", label: "Notas", icon: NotebookPen },
] as const satisfies readonly { id: SheetTabId; label: string; icon: unknown }[];

export type SheetTab = SheetTabId;

// Pestañas de la ficha con el estilo de CampaignTabs; la activa va en `?tab=`. `tabs`: las que se muestran. Barra
// fija (`sticky`) al desplazarse; la barra superior de la web no es fija, así que `top-0`.
export default function SheetTabs({ base, active, tabs }: { base: string; active: SheetTab; tabs: SheetTab[] }) {
  const nav = useRef<HTMLElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const bar = nav.current;
    if (!bar) return;
    // La pestaña activa queda a la vista dentro de la barra, que se desplaza en horizontal en móvil
    const link = bar.querySelector<HTMLElement>("[aria-current]");
    if (link) bar.scrollLeft = Math.max(0, link.offsetLeft - (bar.clientWidth - link.offsetWidth) / 2);
    // Al cambiar de pestaña con la barra pegada arriba, se lleva al inicio del panel nuevo
    if (!first.current && bar.getBoundingClientRect().top <= 0) bar.parentElement?.scrollIntoView({ block: "start" });
    first.current = false;
  }, [active]);
  return (
    <nav
      ref={nav}
      aria-label="Secciones de la ficha"
      className="sticky top-0 z-30 mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line bg-surface [scrollbar-width:none] print:hidden [&::-webkit-scrollbar]:hidden"
    >
      {SHEET_TABS.filter((t) => tabs.includes(t.id)).map(({ id, label, icon: Icon }) => {
        const current = id === active;
        return (
          <Link
            key={id}
            href={id === "acciones" ? base : `${base}?tab=${id}`}
            scroll={false}
            aria-current={current ? "page" : undefined}
            className={`group -mb-px flex items-center gap-2 whitespace-nowrap border-b-[3px] px-4 py-3 text-sm font-semibold transition-colors ${
              current ? "border-brand text-white" : "border-transparent text-muted hover:text-white"
            }`}
          >
            <Icon size={16} aria-hidden="true" className={`transition-transform ${current ? "" : "group-hover:-translate-y-0.5"}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
