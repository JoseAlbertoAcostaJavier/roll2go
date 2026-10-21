"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, X } from "lucide-react";
import Avatar from "@/app/components/Avatar";

export type InviteData = {
  id: string;
  campaignName: string;
  systemName: string;
  inviter: { displayName: string; avatarUrl: string | null } | null;
};

export default function CampaignInvites({ invites }: { invites: InviteData[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function answer(id: string, action: "accept" | "decline") {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/invites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        if (res.status === 404) setHidden((h) => [...h, id]); // la invitación ya no existe
        return;
      }
      window.dispatchEvent(new Event("notifications:changed"));
      if (action === "accept") router.push(`/campaigns/${data.id}`);
      else {
        setHidden((h) => [...h, id]);
        router.refresh();
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setBusy(null);
    }
  }

  const visible = invites.filter((i) => !hidden.includes(i.id));
  if (visible.length === 0) return null;

  return (
    <section className="mb-6 rounded-lg border border-brand/50 bg-brand/5 p-5">
      <h2 className="mb-3 font-heading text-lg font-bold">Invitaciones a campañas</h2>
      <ul className="space-y-3">
        {visible.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3">
              <Avatar url={i.inviter?.avatarUrl} size={40} crown />
              <span className="min-w-0 text-sm">
                <span className="block"><strong>{i.inviter?.displayName ?? "Alguien"}</strong> te invita a unirte a</span>
                <span className="block truncate font-heading font-bold">{i.campaignName}</span>
                <span className="block text-xs text-muted">{i.systemName}</span>
              </span>
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => answer(i.id, "accept")}
                disabled={busy !== null}
                className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50"
              >
                {busy === i.id ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                Aceptar
              </button>
              <button
                type="button"
                onClick={() => answer(i.id, "decline")}
                disabled={busy !== null}
                className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-muted transition-colors enabled:hover:text-white disabled:opacity-50"
              >
                <X size={14} aria-hidden="true" /> Rechazar
              </button>
            </span>
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-sm text-brand-soft" role="alert">{error}</p>}
    </section>
  );
}