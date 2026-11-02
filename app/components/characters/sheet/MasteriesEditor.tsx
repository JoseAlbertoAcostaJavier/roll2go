"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil } from "lucide-react";
import RoundIcon from "@/app/components/ui/RoundIcon";
import { sheetCard, errorClass, primaryButton } from "@/app/components/ui/formStyles";
import { refFromKey } from "../creator/ClassFeaturesSection";
import SkillPicker, { type PickerOption } from "../fields/SkillPicker";

/* Maestrías con armas actuales en la pestaña Rasgos. El dueño puede cambiarlas libremente (Roll2Go no registra los
   descansos largos, tras los que la regla permite cambiar una). `current` y las opciones van por `libro:clave`. */
export default function MasteriesEditor({
  characterId, isOwner, allowed, current, options,
}: {
  characterId: string;
  isOwner: boolean;
  /** Número de maestrías que dan sus clases. */
  allowed: number;
  /** Las actuales, con su etiqueta («Espada corta (Vejar)»). */
  current: PickerOption[];
  /** Armas con maestría y con competencia (del Bárbaro, solo cuerpo a cuerpo). */
  options: PickerOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (allowed === 0 && current.length === 0) return null;
  const filled = value.filter(Boolean);

  function start() {
    setValue(current.map((c) => c.id));
    setError("");
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/characters/${characterId}/masteries`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masteries: filled.map(refFromKey) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`${sheetCard} mb-6 animate-fade-up`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <RoundIcon kind="feature" id="weapon-mastery" label="Maestrías con armas" size={40} />
          <h3 className="font-heading text-xl font-bold">Maestrías con armas</h3>
        </div>
        {isOwner && !editing && (
          <button
            type="button"
            onClick={start}
            className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold transition-colors hover:border-brand hover:text-white print:hidden"
          >
            <Pencil size={14} aria-hidden="true" /> Cambiar maestrías
          </button>
        )}
      </div>

      {!editing ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {current.map((c) => (
            <li key={c.id} className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm">{c.label}</li>
          ))}
          {current.length < allowed && (
            <li className="px-1 py-1.5 text-sm text-muted">
              {current.length === 0 ? "Sin elegir" : `Te falta${allowed - current.length === 1 ? "" : "n"} ${allowed - current.length}`}
            </li>
          )}
        </ul>
      ) : (
        <div className="mt-4 animate-fade-in space-y-3">
          <p className="text-sm text-muted">
            La regla permite cambiar una tras cada descanso largo; aquí puedes cambiarlas todas.
          </p>
          <SkillPicker id="masteries" label="Armas" count={allowed} options={options} value={value} onChange={setValue} />
          {error && <p className={errorClass} role="alert">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-white"
            >
              Cancelar
            </button>
            <button type="button" onClick={save} disabled={saving || filled.length !== allowed} className={primaryButton}>
              {saving && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
              Guardar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
