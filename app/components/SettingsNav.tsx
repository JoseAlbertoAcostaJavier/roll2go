"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, KeyRound, Trash2, User } from "lucide-react";

const ITEMS = [
  { label: "Perfil", href: "/settings/profile", icon: User },
  { label: "Cuenta", href: "/settings/account", icon: KeyRound },
  { label: "Notificaciones", href: "/settings/notifications", icon: Bell },
  { label: "Borrar cuenta", href: "/settings/delete", icon: Trash2 },
];

export default function SettingsNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Ajustes" className="flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.map(({ label, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 whitespace-nowrap rounded-md border-l-4 px-4 py-2.5 text-sm font-semibold transition-colors ${
              active ? "border-brand bg-panel text-white" : "border-transparent text-muted hover:bg-panel hover:text-white"
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