"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { SHEET_TABS, type SheetTab } from "./sheetTabsList";

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
    // Al cambiar de pestaña, si el inicio del panel quedó por encima de la pantalla, se vuelve a él
    const panel = bar.parentElement;
    if (!first.current && panel && panel.getBoundingClientRect().top < 0) panel.scrollIntoView({ block: "start" });
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
