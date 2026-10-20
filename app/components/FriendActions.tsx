"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, MessageSquare, UserCheck, UserMinus, UserPlus, X } from "lucide-react";
import type { Relation } from "@/lib/friends";

const btn = "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50";
const solid = `${btn} bg-brand text-white enabled:hover:bg-brand-hover`;
const outline = `${btn} border border-line text-muted enabled:hover:border-brand enabled:hover:text-white`;

const STATUS: Record<Relation, string> = {
  none: "",
  outgoing: "Solicitud enviada",
  incoming: "Te ha enviado una solicitud",
  friend: "Tu amigo",
};

export default function FriendActions({
  username,
  initialRelation,
  showStatus = false,
}: {
  username: string;
  initialRelation: Relation;
  showStatus?: boolean;
}) {
  const router = useRouter();
  const [relation, setRelation] = useState<Relation>(initialRelation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function request(url: string, method: string, body?: unknown) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return null;
      }
      return data as { relation?: Relation };
    } catch {
      setError("No se pudo conectar con el servidor.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  function done(next: Relation) {
    setRelation(next);
    setConfirming(false);
    window.dispatchEvent(new Event("notifications:changed")); // actualiza el contador del Navbar
    router.refresh();
  }

  const send = async () => {
    const d = await request("/api/friends", "POST", { username });
    if (d) done(d.relation ?? "outgoing");
  };
  const answer = async (action: "accept" | "decline") => {
    const d = await request(`/api/friends/${username}`, "PATCH", { action });
    if (d) done(action === "accept" ? "friend" : "none");
  };
  const remove = async () => {
    const d = await request(`/api/friends/${username}`, "DELETE");
    if (d) done("none");
  };

  const spinner = loading && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />;

  return (
    <div className="flex flex-col items-center gap-2">
      {showStatus && STATUS[relation] && <p className="text-sm text-muted">{STATUS[relation]}</p>}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {relation === "none" && (
          <button type="button" onClick={send} disabled={loading} className={solid}>
            {spinner || <UserPlus size={14} aria-hidden="true" />} Enviar solicitud
          </button>
        )}

        {relation === "outgoing" && (
          <button type="button" onClick={remove} disabled={loading} className={outline}>
            {spinner || <X size={14} aria-hidden="true" />} Cancelar
          </button>
        )}

        {relation === "incoming" && (
          <>
            <button type="button" onClick={() => answer("accept")} disabled={loading} className={solid}>
              {spinner || <UserCheck size={14} aria-hidden="true" />} Aceptar
            </button>
            <button type="button" onClick={() => answer("decline")} disabled={loading} className={outline}>
              <X size={14} aria-hidden="true" /> Rechazar
            </button>
          </>
        )}

        {relation === "friend" && !confirming && (
          <>
            <Link href={`/messages/${username}`} className={solid}>
              <MessageSquare size={14} aria-hidden="true" /> Enviar mensaje
            </Link>
            <button type="button" onClick={() => setConfirming(true)} className={outline}>
              <UserMinus size={14} aria-hidden="true" /> Eliminar
            </button>
          </>
        )}

        {relation === "friend" && confirming && (
          <span className="flex flex-wrap items-center justify-center gap-3 text-sm">
            <span className="text-muted">¿Eliminar de tus amigos?</span>
            <button type="button" onClick={remove} disabled={loading} className="flex items-center gap-1 font-semibold text-brand-soft hover:underline disabled:opacity-50">
              {spinner} Sí, eliminar
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={loading} className="text-muted hover:text-white">
              Cancelar
            </button>
          </span>
        )}
      </div>

      {error && <p className="text-xs text-brand-soft" role="alert">{error}</p>}
    </div>
  );
}