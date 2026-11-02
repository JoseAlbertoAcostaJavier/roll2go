"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

// Inspiración heroica: el dueño la marca o desmarca (optimista, con vuelta atrás si falla); los demás la ven en solo lectura
export default function InspirationBox({ characterId, initial, isOwner, className = "" }: {
  characterId: string; initial: boolean; isOwner: boolean; className?: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [error, setError] = useState("");

  const toggle = async () => {
    const next = !on;
    setOn(next);
    setError("");
    try {
      const res = await fetch(`/api/characters/${characterId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "inspiration", value: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la inspiración.");
    } catch (e) {
      setOn(!next);
      setError(e instanceof Error ? e.message : "No se pudo guardar la inspiración.");
    } finally {
      router.refresh();
    }
  };

  const mark = (
    <span
      aria-hidden="true"
      className={`flex h-10 w-10 items-center justify-center rounded-md border-2 ${on ? "border-brand bg-brand text-white" : "border-brand/50"}`}
    >
      {on && <Check size={24} strokeWidth={3} />}
    </span>
  );
  const label = "text-[11px] font-semibold uppercase tracking-wide text-muted";

  return (
    <div className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-brand/40 bg-panel px-2 py-3 text-center ${className}`}>
      {isOwner ? (
        <button
          type="button"
          aria-pressed={on}
          onClick={toggle}
          className="flex flex-col items-center gap-1 rounded-md focus-visible:outline-2 focus-visible:outline-brand print:hidden"
        >
          {mark}
          <span className={label}>Inspiración heroica</span>
        </button>
      ) : (
        <div className="flex flex-col items-center gap-1 print:hidden">
          {mark}
          <span className={label}>
            Inspiración heroica<span className="sr-only">: {on ? "sí" : "no"}</span>
          </span>
        </div>
      )}
      <p className="hidden text-xs font-semibold print:block">Inspiración heroica: {on ? "Sí" : "No"}</p>
      {error && <p role="alert" className="text-xs text-brand-soft">{error}</p>}
    </div>
  );
}
