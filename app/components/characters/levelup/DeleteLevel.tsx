"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";
import { CampaignDialog } from "@/app/components/campaigns/CharacterActions";

const secondaryButton =
  "flex items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold transition-colors hover:border-brand hover:text-white disabled:opacity-50";

/* Borra el último nivel del personaje tras confirmarlo (`DELETE /api/characters/[id]/levels/last`). */
export default function DeleteLevel({ characterId, level, redirectTo, buttonClass }: {
  characterId: string;
  /** Nivel actual (el que se borra). */
  level: number;
  /** A dónde ir después; si no, se recarga la página. */
  redirectTo?: string;
  /** Aspecto del botón, si no es el de por defecto. */
  buttonClass?: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState<HTMLElement | null>(null);
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
      setAsking(null);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={(e) => setAsking(e.currentTarget)} aria-haspopup="dialog" className={buttonClass ?? secondaryButton}>
        <Trash2 size={buttonClass ? 14 : 16} aria-hidden="true" /> Borrar nivel
      </button>
      {asking && (
        <CampaignDialog title={`Borrar el nivel ${level}`} opener={asking} onClose={() => !loading && setAsking(null)}>
          <p className="mb-5 text-sm text-muted">Se perderán los PG, rasgos y elecciones del nivel {level}.</p>
          {error && <p role="alert" className="mb-4 text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" data-autofocus onClick={() => setAsking(null)} disabled={loading} className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors enabled:hover:text-white disabled:opacity-50">
              Cancelar
            </button>
            <button type="button" onClick={run} disabled={loading} className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50">
              {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
              Borrar nivel {level}
            </button>
          </div>
        </CampaignDialog>
      )}
    </>
  );
}
