import Link from "next/link";
import { Backpack, BookUser, Sparkles, Swords, WandSparkles } from "lucide-react";
import type { SheetTabId } from "@/lib/rules/dnd2024/sheet/sheetTabs";

export const SHEET_TABS = [
  { id: "acciones", label: "Acciones", icon: Swords },
  { id: "conjuros", label: "Conjuros", icon: WandSparkles },
  { id: "inventario", label: "Inventario", icon: Backpack },
  { id: "rasgos", label: "Rasgos y dotes", icon: Sparkles },
  { id: "trasfondo", label: "Trasfondo", icon: BookUser },
] as const satisfies readonly { id: SheetTabId; label: string; icon: unknown }[];

export type SheetTab = SheetTabId;

// Pestañas de la ficha con el estilo de CampaignTabs; la activa va en `?tab=`. `tabs`: las que se muestran.
export default function SheetTabs({ base, active, tabs }: { base: string; active: SheetTab; tabs: SheetTab[] }) {
  return (
    <nav aria-label="Secciones de la ficha" className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line print:hidden">
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
