"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Megaphone, X } from "lucide-react";
import Avatar from "@/app/components/Avatar";
import { timeAgo } from "@/lib/timeAgo";

export type NotificationData = {
  id: string;
  type: string;
  read: boolean;
  createdAt: string;
  text: string;
  href: string;
  actor: { username: string; displayName: string; avatarUrl: string | null } | null;
};

export default function NotificationItem({
  item,
  onOpen,
  onRemove,
}: {
  item: NotificationData;
  onOpen: (item: NotificationData) => void;
  onRemove: (id: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isRequest = item.type === "friend_request" && !!item.actor;

  // Las solicitudes de amistad se responden desde la propia notificación
  async function answer(action: "accept" | "decline") {
    if (!item.actor) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/friends/${item.actor.username}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        onRemove(item.id);
        window.dispatchEvent(new Event("notifications:changed"));
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`flex items-center gap-2 px-4 py-3 ${item.read ? "" : "bg-brand/10"}`}>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {item.actor ? (
          <Avatar url={item.actor.avatarUrl} size={40} />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
            <Megaphone size={18} aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-sm">{item.text}</span>
          <span className="block text-xs text-muted">{timeAgo(item.createdAt)}</span>
        </span>
      </button>

      {isRequest && (
        <span className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => answer("accept")}
            disabled={busy}
            aria-label="Aceptar solicitud"
            title="Aceptar"
            className="flex h-8 w-8 items-center justify-center rounded border border-[#6fd08c] text-[#6fd08c] transition-colors hover:bg-[#6fd08c] hover:text-black disabled:opacity-50"
          >
            <Check size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => answer("decline")}
            disabled={busy}
            aria-label="Rechazar solicitud"
            title="Rechazar"
            className="flex h-8 w-8 items-center justify-center rounded border border-brand text-brand-soft transition-colors hover:bg-brand hover:text-white disabled:opacity-50"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </span>
      )}
    </li>
  );
}