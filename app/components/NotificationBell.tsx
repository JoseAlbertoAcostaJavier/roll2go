"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import NotificationItem, { type NotificationData } from "@/app/components/NotificationItem";
import useDismiss from "@/app/components/useDismiss";

const json = { "Content-Type": "application/json" };

export default function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationData[] | null>(null);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=10", { cache: "no-store" });
      if (!res.ok) return setError("No se pudieron cargar las notificaciones.");
      const data = await res.json();
      setItems(data.items);
      setUnread(data.unread);
      setError("");
    } catch {
      setError("No se pudieron cargar las notificaciones.");
    }
  }, []);

  // El contador se actualiza cada minuto, al volver a la pestaña y cuando otra parte de la web avisa de un cambio
  useEffect(() => {
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/notifications?limit=0", { cache: "no-store" });
        if (res.ok) setUnread((await res.json()).unread);
      } catch {
        /* sin conexión: se reintenta en el siguiente ciclo */
      }
    };
    const id = setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("notifications:changed", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("notifications:changed", refresh);
    };
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void load();
  }

  function openItem(item: NotificationData) {
    setOpen(false);
    if (!item.read) {
      setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, read: true } : i)) ?? prev);
      setUnread((u) => Math.max(0, u - 1));
      fetch("/api/notifications/read", { method: "POST", headers: json, body: JSON.stringify({ id: item.id }) }).catch(() => {});
    }
    router.push(item.href);
  }

  function markAll() {
    setItems((prev) => prev?.map((i) => ({ ...i, read: true })) ?? prev);
    setUnread(0);
    fetch("/api/notifications/read", { method: "POST", headers: json, body: JSON.stringify({ all: true }) }).catch(() => {});
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones"}
        className="flex h-10 items-center gap-2 rounded px-3 text-sm font-medium text-gray-300 transition-colors hover:text-white"
      >
        <span className="relative">
          <Bell size={20} aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </span>
        <span className="hidden nav:inline">Notificaciones</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-panel shadow-[0_12px_30px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
              Notificaciones
              {unread > 0 && (
                <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] text-white">
                  {unread} {unread === 1 ? "nueva" : "nuevas"}
                </span>
              )}
            </p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="text-xs text-brand-soft hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {error ? (
              <p className="px-4 py-6 text-center text-sm text-brand-soft">{error}</p>
            ) : items === null ? (
              <p className="px-4 py-6 text-center text-sm text-muted">Cargando...</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">No tienes notificaciones.</p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((item) => (
                  <NotificationItem
                    key={item.id}
                    item={item}
                    onOpen={openItem}
                    onRemove={(id) => setItems((prev) => prev?.filter((i) => i.id !== id) ?? prev)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
            <Link href="/notifications" onClick={close} className="text-muted hover:text-white">Ver todas</Link>
            <Link href="/messages" onClick={close} className="text-muted hover:text-white">Mensajes</Link>
            <Link href="/social" onClick={close} className="text-muted hover:text-white">Lista de Amigos</Link>
          </div>
        </div>
      )}
    </div>
  );
}