"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

// Inspiración heroica: el dueño la marca o desmarca (optimista, con vuelta atrás si falla); los demás la ven en solo lectura
export default function InspirationBox({ characterId, initial, isOwner, className = "" }: {
  characterId: string; initial: boolean; isOwner: boolean; className?: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [error, setError] = useState("");
  // Una sola petición a la vez: los clics mientras hay una pendiente o mientras llega su refresco se ignoran (si no, el
  // refresco de la primera traería el valor anterior al segundo cambio)
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const busy = saving || refreshing;
  // Tras un refresco (otra pestaña o dispositivo) adopta el valor nuevo, salvo que haya una petición en curso
  const [shown, setShown] = useState(initial);
  if (shown !== initial && !busy) {
    setShown(initial);
    setOn(initial);
  }

  const toggle = async () => {
    if (pending.current || refreshing) return;
    pending.current = true;
    setSaving(true);
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
      startRefresh(() => router.refresh());
    } catch (e) {
      setOn(!next);
      setError(e instanceof Error ? e.message : "No se pudo guardar la inspiración.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  const frame = `flex h-10 w-full items-center justify-center gap-2 rounded-md border px-3 font-heading text-sm font-bold uppercase transition-colors print:hidden ${
    on ? "border-brand bg-brand/15 text-white" : "border-line-strong text-fg"
  }`;
  const content = (
    <>
      Inspiración
      <Sparkles size={16} aria-hidden="true" className={on ? "fill-brand-soft text-brand-soft" : "text-muted"} />
    </>
  );

  return (
    // El error va fuera de la caja: flota justo debajo
    <div className={`relative ${className}`}>
      {isOwner ? (
        <button
          type="button"
          aria-pressed={on}
          onClick={toggle}
          aria-label="Inspiración heroica"
          className={`${frame} cursor-pointer hover:border-fg focus-visible:outline-2 focus-visible:outline-brand`}
        >
          {content}
        </button>
      ) : (
        <div className={frame}>
          {content}
          <span className="sr-only">: {on ? "sí" : "no"}</span>
        </div>
      )}
      <p className="hidden text-xs font-semibold print:block">Inspiración heroica: {on ? "Sí" : "No"}</p>
      {error && (
        <p role="alert" className="absolute inset-x-0 top-full z-10 mt-1 rounded-md border border-line bg-surface px-2 py-1 text-xs text-danger">{error}</p>
      )}
    </div>
  );
}
