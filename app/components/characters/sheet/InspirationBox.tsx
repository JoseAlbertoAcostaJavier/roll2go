"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

// Inspiración heroica: el dueño la marca o desmarca (optimista, con vuelta atrás si falla); los demás la ven en solo lectura
export default function InspirationBox({ characterId, initial, isOwner, className = "" }: {
  characterId: string; initial: boolean; isOwner: boolean; className?: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [error, setError] = useState("");
  // Una sola petición a la vez: los clics mientras hay una pendiente se ignoran
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  // Tras un refresco (otra pestaña o dispositivo) adopta el valor nuevo, salvo que haya una petición en curso
  const [shown, setShown] = useState(initial);
  if (shown !== initial && !busy) {
    setShown(initial);
    setOn(initial);
  }

  const toggle = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
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
      router.refresh();
    } catch (e) {
      setOn(!next);
      setError(e instanceof Error ? e.message : "No se pudo guardar la inspiración.");
    } finally {
      pending.current = false;
      setBusy(false);
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
    // El error va fuera de la caja (de alto fijo): flota justo debajo
    <div className="relative">
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
    </div>
      {error && (
        <p role="alert" className="absolute inset-x-0 top-full z-10 mt-1 rounded-md border border-line bg-surface px-2 py-1 text-xs text-brand-soft">{error}</p>
      )}
    </div>
  );
}
