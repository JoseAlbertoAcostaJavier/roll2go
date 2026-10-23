import Link from "next/link";
import { Backpack, BookUser, Info, Sparkles, WandSparkles } from "lucide-react";

export const SHEET_TABS = [
  { id: "info", label: "Información", icon: Info },
  { id: "trasfondo", label: "Trasfondo", icon: BookUser },
  { id: "rasgos", label: "Rasgos", icon: Sparkles },
  { id: "equipo", label: "Equipo", icon: Backpack },
  { id: "conjuros", label: "Conjuros", icon: WandSparkles },
] as const;

export type SheetTab = (typeof SHEET_TABS)[number]["id"];

export const isSheetTab = (v: unknown): v is SheetTab => SHEET_TABS.some((t) => t.id === v);

// Pestañas de la ficha con el estilo de CampaignTabs; la activa va en `?tab=`. `tabs`: las que se muestran.
export default function SheetTabs({ base, active, tabs }: { base: string; active: SheetTab; tabs: SheetTab[] }) {
  return (
    <nav aria-label="Secciones de la ficha" className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line print:hidden">
      {SHEET_TABS.filter((t) => tabs.includes(t.id)).map(({ id, label, icon: Icon }) => {
        const current = id === active;
        return (
          <Link
            key={id}
            href={id === "info" ? base : `${base}?tab=${id}`}
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
