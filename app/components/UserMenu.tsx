"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Pencil, Settings, User as UserIcon, MessageSquare, Megaphone, Users } from "lucide-react";
import Avatar from "@/app/components/Avatar";
import useDismiss from "@/app/components/useDismiss";

export type NavUser = { id: string; username: string; displayName: string; role?: "user" | "admin"; avatarUrl: string | null };

const item =
  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-200 transition-colors hover:bg-line hover:text-white";

export default function UserMenu({ user }: { user: NavUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setOpen(false);
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded border border-line bg-panel px-3 transition-colors hover:bg-line"
      >
        <Avatar url={user.avatarUrl} size={28} />
        <span className="hidden max-w-40 truncate text-sm font-medium text-gray-200 sm:block">
          Hola, {user.displayName}
        </span>
        <ChevronDown size={14} className="hidden text-gray-400 sm:block" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 origin-top-right animate-pop overflow-hidden rounded-lg border border-line bg-panel shadow-[0_12px_30px_rgba(0,0,0,0.6)]"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-bold">{user.displayName}</p>
            <p className="truncate text-xs text-muted">@{user.username}</p>
          </div>
          <Link href="/profile" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <UserIcon size={16} aria-hidden="true" /> Ver mi perfil
          </Link>
          <Link href="/social" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <Users size={16} aria-hidden="true" /> Mis amigos
          </Link>
          <Link href="/messages" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <MessageSquare size={16} aria-hidden="true" /> Mensajes
          </Link>          
          <Link href="/settings/profile" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <Pencil size={16} aria-hidden="true" /> Editar perfil
          </Link>
          <Link href="/settings/account" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <Settings size={16} aria-hidden="true" /> Mi cuenta
          </Link>
          {user.role === "admin" && (
            <Link href="/admin/announcements" role="menuitem" onClick={() => setOpen(false)} className={item}>
              <Megaphone size={16} aria-hidden="true" /> Avisos de Roll2Go
            </Link>
          )}          
          <button type="button" role="menuitem" onClick={logout} className={`${item} border-t border-line`}>
            <LogOut size={16} aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}