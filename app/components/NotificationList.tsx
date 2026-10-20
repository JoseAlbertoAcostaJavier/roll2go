"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NotificationItem, { type NotificationData } from "@/app/components/NotificationItem";

export default function NotificationList() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationData[] | null>(null);
  const [error, setError] = useState("");

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

  if (error) return <p className="text-sm text-brand-soft" role="alert">{error}</p>;
  if (items === null) return <p className="text-sm text-muted">Cargando...</p>;
  if (items.length === 0) return <div className="rounded-lg border border-dashed border-line p-10 text-center text-muted">No tienes notificaciones.</div>;

  return (
    <div>
      {items.some((i) => !i.read) && (
        <button type="button" onClick={markAll} className="mb-3 text-sm text-brand-soft hover:underline">
          Marcar todas como leídas
        </button>
      )}
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