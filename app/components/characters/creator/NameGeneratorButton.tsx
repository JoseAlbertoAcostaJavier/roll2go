"use client";

import { useState } from "react";
import { Dices, LoaderCircle } from "lucide-react";
import type { Pronoun } from "@/lib/rules/dnd2024/creation/names";

/* Botón 🎲 junto al nombre: pide al servidor un nombre al azar para la especie (identificador) y los pronombres. */
export default function NameGeneratorButton({
  species, pronouns, onName,
}: {
  /** Identificador de la especie (`dwarf`…); vacío = tablas de Humano. */
  species: string;
  pronouns: Pronoun[];
  onName: (name: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ species, pronouns: pronouns.join(",") });
      const res = await fetch(`/api/rules/names?${qs.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.name !== "string") throw new Error(data?.error);
      onName(data.name);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "No se pudo generar un nombre.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        title="Generar un nombre al azar"
        aria-label="Generar un nombre al azar"
        className="flex h-11.5 w-11.5 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-brand-soft transition-colors enabled:hover:border-brand enabled:hover:text-white disabled:opacity-60"
      >
        {loading ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Dices size={18} aria-hidden="true" />}
      </button>
      {error && <p role="alert" className="mt-1 w-full text-xs text-danger">{error}</p>}
    </>
  );
}
