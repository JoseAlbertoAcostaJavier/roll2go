"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FeatureUse } from "@/lib/rules/dnd2024/derive/featureUses";
import UseBoxes from "./UseBoxes";

const recoveryLabel = (use: FeatureUse) => (use.recovery.short === "all" ? "Descanso corto" : "Descanso largo");

// Usos de un rasgo («Furia □□ / Descanso largo»): el dueño los marca (optimista, con vuelta atrás si falla); los demás
// los ven en solo lectura. Una sola petición a la vez, como `InspirationBox`.
export default function FeatureUsesControl({ characterId, use, isOwner, className = "" }: {
  characterId: string; use: FeatureUse; isOwner: boolean; className?: string;
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
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 print:hidden">
        <UseBoxes
          count={use.max} used={used} busy={busy} onSet={isOwner ? set : null}
          label={`Usos de ${use.name}`} itemLabel={`Uso de ${use.name}`}
        />
        <span className="text-xs text-muted">/ {recoveryLabel(use)}</span>
      </div>
      <p className="hidden text-xs print:block">{use.max - spent}/{use.max} · {recoveryLabel(use)}</p>
      {error && <p role="alert" className="mt-1 text-xs text-brand-soft">{error}</p>}
    </div>
  );
}
