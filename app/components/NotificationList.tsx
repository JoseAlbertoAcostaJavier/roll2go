"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellOff, CheckCheck, Trash2 } from "lucide-react";
import NotificationItem, { type NotificationData } from "@/app/components/NotificationItem";

export default function NotificationList() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationData[] | null>(null);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications?limit=50", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fail"))))
      .then((d) => !cancelled && setItems(d.items))
      .catch(() => !cancelled && setError("No se pudieron cargar las notificaciones."));
    return () => {
      cancelled = true;
    };
  }, []);

  function open(item: NotificationData) {
    if (!item.read) {
      fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      })
        .then(() => window.dispatchEvent(new Event("notifications:changed")))
        .catch(() => {});
    }
    router.push(item.href);
  }

  function markAll() {
    setItems((prev) => prev?.map((i) => ({ ...i, read: true })) ?? prev);
    fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    })
      .then(() => window.dispatchEvent(new Event("notifications:changed")))
      .catch(() => {});
  }

  async function clearAll() {
    const prev = items;
    setItems([]);
    setConfirmClear(false);
    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error();
      window.dispatchEvent(new Event("notifications:changed"));
    } catch {
      setItems(prev); // se deshace
      setError("No se pudieron borrar las notificaciones.");
    }
  }

  if (error) return <p className="text-sm text-brand-soft" role="alert">{error}</p>;
  if (items === null)
    return (
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel" aria-label="Cargando">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex animate-pulse items-center gap-3 px-4 py-3">
            <span className="h-10 w-10 rounded-full bg-line" />
            <span className="flex-1 space-y-2">
              <span className="block h-3 w-3/4 rounded bg-line" />
              <span className="block h-2.5 w-1/4 rounded bg-line" />
            </span>
          </li>
        ))}
      </ul>
    );
  if (items.length === 0)
    return (
      <div className="flex animate-fade-in flex-col items-center gap-2 rounded-lg border border-dashed border-line p-10 text-center text-muted">
        <BellOff size={28} aria-hidden="true" />
        No tienes notificaciones.
      </div>
    );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        {items.some((i) => !i.read) ? (
          <button type="button" onClick={markAll} className="flex items-center gap-1.5 text-brand-soft hover:underline">
            <CheckCheck size={16} aria-hidden="true" /> Marcar todas como leídas
          </button>
        ) : (
          <span />
        )}
        {confirmClear ? (
          <span className="flex animate-fade-in items-center gap-3">
            <span className="text-muted">¿Borrar todas?</span>
            <button type="button" onClick={clearAll} className="font-semibold text-brand-soft hover:underline">Sí, borrar</button>
            <button type="button" onClick={() => setConfirmClear(false)} className="text-muted hover:text-white">Cancelar</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmClear(true)} className="flex items-center gap-1.5 text-muted hover:text-white">
            <Trash2 size={16} aria-hidden="true" /> Borrar todas
          </button>
        )}
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
        {items.map((item) => (
          <NotificationItem
            key={item.id}
            item={item}
            onOpen={open}
            onRemove={(id) => setItems((prev) => prev?.filter((i) => i.id !== id) ?? prev)}
          />
        ))}
      </ul>
    </div>
  );
}