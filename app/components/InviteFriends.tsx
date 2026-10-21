"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Send } from "lucide-react";
import Avatar from "@/app/components/Avatar";

export type FriendOption = { username: string; displayName: string; avatarUrl: string | null };

export default function InviteFriends({ campaignId, friends }: { campaignId: string; friends: FriendOption[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [done, setDone] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const term = q.trim().toLowerCase();
  const list = friends.filter(
    (f) =>
      !done.includes(f.username) &&
      (!term || f.username.toLowerCase().includes(term) || f.displayName.toLowerCase().includes(term)),
  );

  async function invite(username: string) {
    setBusy(username);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
      setDone((prev) => [...prev, username]);
      router.refresh(); // pasa a "Invitaciones pendientes"
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setBusy(null);
    }
  }

  if (friends.length === 0) {
    return (
      <p className="text-sm text-muted">
        No tienes amigos disponibles para invitar. Añádelos desde{" "}
        <Link href="/social" className="font-semibold text-white hover:text-brand-soft">Social</Link> o comparte el enlace
        de invitación.
      </p>
    );
  }

  return (
    <div>
      {friends.length > 5 && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar amigos"
          aria-label="Filtrar amigos"
          className="mb-3 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none"
        />
      )}
      {list.length === 0 ? (
        <p className="text-sm text-muted">No hay amigos que coincidan.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line bg-surface">
          {list.map((f) => (
            <li key={f.username} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar url={f.avatarUrl} size={32} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{f.displayName}</span>
                  <span className="block truncate text-xs text-muted">@{f.username}</span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => invite(f.username)}
                disabled={busy !== null}
                className="flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50"
              >
                {busy === f.username ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
                Invitar
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-sm text-brand-soft" role="alert">{error}</p>}
    </div>
  );
}