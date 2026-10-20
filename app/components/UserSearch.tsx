"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import Avatar from "@/app/components/Avatar";
import FriendActions from "@/app/components/FriendActions";
import useDismiss from "@/app/components/useDismiss";
import type { Relation } from "@/lib/friends";

type Result = { username: string; displayName: string; avatarUrl: string | null; relation: Relation };

/* Buscador con sugerencias: a medida que se escribe, aparecen los usuarios cuyo usuario o nombre visible
   empieza por lo escrito (mínimo 2 letras). Pasados 250 ms sin teclear, se consulta al servidor. */
export default function UserSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const term = q.trim();
  const active = term.length >= 2;

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.error ?? "No se pudo buscar.");
          setResults([]);
          return;
        }
        setResults(data.users);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("No se pudo conectar con el servidor.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  return (
    <div ref={ref} className="relative">
      <label htmlFor="user-search" className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
        <UserPlus size={16} aria-hidden="true" /> Añadir a mi lista de amigos
      </label>
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id="user-search"
          type="search"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          value={q}
          placeholder="Nombre de usuario o nombre visible"
          aria-expanded={open && active}
          aria-controls="user-search-results"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="h-12 w-full rounded-md border border-line bg-surface pl-10 pr-3 text-fg placeholder:text-muted focus:border-brand focus:outline-none"
        />
      </div>

      {open && active && (
        <div
          id="user-search-results"
          className="absolute inset-x-0 top-full z-30 mt-2 max-h-96 overflow-y-auto rounded-lg border border-line bg-panel shadow-[0_12px_30px_rgba(0,0,0,0.6)]"
        >
          {error ? (
            <p className="px-4 py-3 text-sm text-brand-soft" role="alert">{error}</p>
          ) : loading && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">Buscando...</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">No se han encontrado usuarios.</p>
          ) : (
            <ul className="divide-y divide-line">
              {results.map((u) => (
                <li key={u.username} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <Link href={`/users/${u.username}`} className="flex min-w-0 items-center gap-3 hover:underline">
                    <Avatar url={u.avatarUrl} size={40} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{u.displayName}</span>
                      <span className="block truncate text-xs text-muted">@{u.username}</span>
                    </span>
                  </Link>
                  <FriendActions username={u.username} initialRelation={u.relation} showStatus />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}