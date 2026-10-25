"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

export default function ConfirmAction({
  url,
  method = "DELETE",
  label,
  question,
  confirmLabel,
  redirectTo,
}: {
  url: string;
  method?: "DELETE" | "POST" | "PUT";
  label: string; // texto del botón
  question: string; // pregunta de confirmación
  confirmLabel: string; // texto del botón que confirma
  redirectTo?: string; // a dónde ir tras hacerlo (si no, se refresca la página)
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(url, { method });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
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
      <button type="button" onClick={() => setAsking(true)} className="text-sm text-brand-soft hover:underline">
        {label}
      </button>
    );
  }

  return (
    <span className="flex animate-fade-in flex-wrap items-center gap-3 text-sm">
      <span className="text-muted">{question}</span>
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="flex items-center gap-1 font-semibold text-brand-soft hover:underline disabled:opacity-50"
      >
        {loading && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}
        {confirmLabel}
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
      {error && (
        <span className="w-full text-xs text-brand-soft" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}