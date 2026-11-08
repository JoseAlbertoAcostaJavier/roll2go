"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import type { FeatureUse } from "@/lib/rules/dnd2024/derive/featureUses";
import UseBoxes from "./UseBoxes";

const recoveryLabel = (use: FeatureUse) => (use.recovery.short === "all" ? "Descanso corto" : "Descanso largo");

// Usos de un rasgo («Furia □□ / Descanso largo»): el dueño los marca (optimista, con vuelta atrás si falla); los demás
// los ven en solo lectura. Una sola petición a la vez, como `InspirationBox`.
export default function FeatureUsesControl({ characterId, use, isOwner, className = "", showName = false, stepper = false }: {
  characterId: string; use: FeatureUse; isOwner: boolean; className?: string;
  /** Muestra el nombre del contador antes de las casillas (grupos con varios contadores). */
  showName?: boolean;
  /** «− disponibles/máximo +» (caja de recursos), en vez de las casillas. */
  stepper?: boolean;
}) {
  const router = useRouter();
  const [used, setUsed] = useState(use.used);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const busy = saving || refreshing;
  // Tras un refresco (descanso, otra pestaña) adopta el valor nuevo, salvo que haya una petición en curso
  const [shown, setShown] = useState(use.used);
  if (shown !== use.used && !busy) {
    setShown(use.used);
    setUsed(use.used);
  }

  const set = async (next: number) => {
    if (pending.current || refreshing) return;
    pending.current = true;
    setSaving(true);
    const before = used;
    setUsed(next);
    setError("");
    try {
      const res = await fetch(`/api/characters/${characterId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "featureUse", key: use.key, used: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar el uso.");
      startRefresh(() => router.refresh());
    } catch (e) {
      setUsed(before);
      setError(e instanceof Error ? e.message : "No se pudo guardar el uso.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  const spent = Math.min(used, use.max);
  if (stepper) {
    const stepClass = "flex h-9 w-9 shrink-0 items-center justify-center bg-line/60 text-fg transition-colors enabled:hover:bg-line disabled:opacity-40";
    return (
      <div className={className}>
        <p className="mb-1 text-sm font-semibold text-fg">{use.name}</p>
        <div title={recoveryLabel(use)} className="flex items-center overflow-hidden rounded-md border border-line print:hidden">
          {isOwner && (
            <button type="button" className={stepClass} disabled={busy || spent >= use.max} aria-label={`Gastar un uso de ${use.name}`} onClick={() => set(spent + 1)}>
              <Minus size={16} aria-hidden="true" />
            </button>
          )}
          <span className="flex-1 text-center font-heading font-bold text-white" aria-live="polite">
            {use.max - spent}<span className="text-muted">/{use.max}</span>
          </span>
          {isOwner && (
            <button type="button" className={stepClass} disabled={busy || spent <= 0} aria-label={`Recuperar un uso de ${use.name}`} onClick={() => set(spent - 1)}>
              <Plus size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="hidden text-xs print:block">{use.max - spent}/{use.max} · {recoveryLabel(use)}</p>
        {error && <p role="alert" className="mt-1 text-xs text-danger print:hidden">{error}</p>}
      </div>
    );
  }
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 print:hidden">
        {showName && <span className="text-sm font-semibold">{use.name}</span>}
        <UseBoxes
          count={use.max} used={used} busy={busy} onSet={isOwner ? set : null}
          label={`Usos de ${use.name}`} itemLabel={`Uso de ${use.name}`}
        />
        <span className="text-xs text-muted">/ {recoveryLabel(use)}</span>
      </div>
      <p className="hidden text-xs print:block">{showName && `${use.name}: `}{use.max - spent}/{use.max} · {recoveryLabel(use)}</p>
      {error && <p role="alert" className="mt-1 print:hidden text-xs text-danger">{error}</p>}
    </div>
  );
}
