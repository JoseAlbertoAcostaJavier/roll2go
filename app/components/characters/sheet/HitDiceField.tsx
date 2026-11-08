"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HitDicePool } from "@/lib/rules/dnd2024/sheet/rest";
import { tagChip } from "./statUi";

// Dados de golpe de una clase: «D8 (Pícaro) [9] / 10». El dueño escribe cuántos le quedan
export default function HitDiceField({ characterId, pool, isOwner }: { characterId: string; pool: HitDicePool; isOwner: boolean }) {
  const router = useRouter();
  const free = pool.total - pool.used;
  const [draft, setDraft] = useState(String(free));
  const [shown, setShown] = useState(free);
  const [error, setError] = useState("");
  // Tras un descanso (u otro cambio del servidor), el campo adopta lo guardado
  if (shown !== free) {
    setShown(free);
    setDraft(String(free));
  }

  async function commit() {
    const value = Math.min(pool.total, Math.max(0, Math.trunc(Number(draft)) || 0));
    setDraft(String(value));
    if (value === free) return;
    setError("");
    try {
      const res = await fetch(`/api/characters/${characterId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "hitDice", key: pool.classKey, used: pool.total - value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudieron guardar los dados.");
      router.refresh();
    } catch (e) {
      setDraft(String(free));
      setError(e instanceof Error ? e.message : "No se pudieron guardar los dados.");
    }
  }

  return (
    <span className="flex items-center gap-2 text-sm">
      <span className={tagChip}>D{pool.die} ({pool.name})</span>
      {isOwner ? (
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={pool.total}
          value={draft}
          aria-label={`Dados de golpe que quedan de ${pool.name}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className="h-8 w-11 rounded-md border border-line-strong bg-surface text-center font-heading font-bold text-white focus:border-brand focus:outline-none [appearance:textfield] print:border-0 [&::-webkit-inner-spin-button]:appearance-none"
        />
      ) : <span className="font-heading font-bold text-white">{free}</span>}
      <span className="font-heading font-bold text-white">/ {pool.total}</span>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
