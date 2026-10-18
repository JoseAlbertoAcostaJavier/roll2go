"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, ScrollText, UserPlus, Users } from "lucide-react";

const TABS = [
  { label: "Detalles", suffix: "", icon: FileText },
  { label: "Personajes", suffix: "/characters", icon: Users },
  { label: "Diario de campaña", suffix: "/log", icon: ScrollText },
  { label: "Participantes", suffix: "/members", icon: UserPlus },
];

// base: dirección de la campaña, por ejemplo "/campaigns/6710f3a2..."
export default function CampaignTabs({ base }: { base: string }) {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Secciones de la campaña" className="flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map(({ label, suffix, icon: Icon }) => {
        const href = base + suffix;
        // "Detalles" solo está activa en la dirección exacta; las demás también en sus subpáginas
        const active = suffix === "" ? pathname === base : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-[3px] px-4 py-3 text-sm font-semibold transition-colors ${
              active ? "border-brand text-white" : "border-transparent text-muted hover:text-white"
            }`}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}