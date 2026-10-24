"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";

const secondaryButton =
  "flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold transition-colors hover:border-brand hover:text-white disabled:opacity-50";

/* Borra el último nivel del personaje tras confirmarlo (`DELETE /api/characters/[id]/levels/last`). */
export default function DeleteLevel({ characterId, level, redirectTo }: {
  characterId: string;
  /** Nivel actual (el que se borra). */
  level: number;
  /** A dónde ir después; si no, se recarga la página. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/characters/${characterId}/levels/last`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
      setAsking(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={secondaryButton}>
        <Trash2 size={16} aria-hidden="true" /> Borrar nivel
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-label={`Borrar el nivel ${level}`} className="flex w-full animate-pop flex-wrap items-center gap-3 rounded-md border border-brand/50 bg-brand/10 px-3 py-2 text-sm sm:w-auto">
      <span>Se perderán los PG, rasgos y elecciones del nivel {level}.</span>
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 font-semibold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50"
      >
        {loading && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}
        Borrar nivel {level}
      </button>
      <button
        type="button"
        onClick={() => {
          setAsking(false);
          setError("");
        }}
        disabled={loading}
        className="text-muted hover:text-white disabled:opacity-50"
      >
        Cancelar
      </button>
      {error && <span role="alert" className="w-full text-xs text-brand-soft">{error}</span>}
    </div>
  );
}
