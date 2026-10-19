"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, LoaderCircle } from "lucide-react";
import LocalDate from "@/app/components/LocalDate";
const OPTIONS = [
  ["never", "No caduca"],
  ["1d", "1 día"],
  ["7d", "7 días"],
  ["30d", "30 días"],
] as const;


// Dirección de la web: solo existe en el navegador (en el servidor es "" y no hay diferencia al cargar)
const noop = () => () => {};
const useOrigin = () => useSyncExternalStore(noop, () => window.location.origin, () => "");

export default function InviteLink({
  campaignId,
  initialCode,
  initialExpiresAt,
}: {
  campaignId: string;
  initialCode: string | null; // null si no hay enlace o ya caducó
  initialExpiresAt: string | null;
}) {
  const origin = useOrigin();
  const [code, setCode] = useState(initialCode);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [expiresIn, setExpiresIn] = useState<(typeof OPTIONS)[number][0]>("7d");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const link = code ? `${origin}/join/${code}` : "";

  async function request(method: "POST" | "DELETE") {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/invite`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ expiresIn }) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
      if (method === "POST") {
        setCode(data.code);
        setExpiresAt(data.expiresAt);
      } else {
        setCode(null);
        setExpiresAt(null);
      }
      setCopied(false);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar. Selecciona el enlace y cópialo a mano.");
    }
  }

  const select = (
    <select
      value={expiresIn}
      onChange={(e) => setExpiresIn(e.target.value as (typeof OPTIONS)[number][0])}
      aria-label="Caducidad del enlace"
      className="h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none"
    >
      {OPTIONS.map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
  const primary =
    "flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50";

  return (
    <div>
      {code ? (
        <>
          <label htmlFor="invite-link" className="mb-1.5 block text-sm font-semibold">Enlace de invitación</label>
          <div className="flex gap-2">
            <input
              id="invite-link"
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-sm text-fg"
            />
            <button type="button" onClick={copy} className={primary}>
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">
            {expiresAt ? <>Caduca el <LocalDate iso={expiresAt} />.</> : "No caduca."} Cualquiera que tenga el enlace puede unirse.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {select}
            <button type="button" onClick={() => request("POST")} disabled={loading} className="text-sm text-brand-soft hover:underline disabled:opacity-50">
              Generar un enlace nuevo (el anterior deja de valer)
            </button>
            <button type="button" onClick={() => request("DELETE")} disabled={loading} className="text-sm text-muted hover:text-white disabled:opacity-50">
              Desactivar enlace
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            Ahora mismo no hay ningún enlace activo. Crea uno y compártelo con tus jugadores.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {select}
            <button type="button" onClick={() => request("POST")} disabled={loading} className={primary}>
              {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
              Crear enlace de invitación
            </button>
          </div>
        </>
      )}
      {error && <p className="mt-3 text-sm text-brand-soft" role="alert">{error}</p>}
    </div>
  );
}