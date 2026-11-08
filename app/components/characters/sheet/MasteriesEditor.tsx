"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { refFromKey } from "../creator/ClassFeaturesSection";
import type { PickerOption } from "../fields/SkillPicker";
import { SectionBar, switchThumb, switchTrack } from "./statUi";

/* Maestrías con armas: un interruptor por arma, hasta las que dan sus clases. El dueño puede cambiarlas libremente (Roll2Go
   no registra los descansos largos, tras los que la regla permite cambiar una). `current` y las opciones van por `libro:clave`. */
export default function MasteriesEditor({ characterId, isOwner, allowed, current, options }: {
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
  const [value, setValue] = useState(current.map((c) => c.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (allowed === 0 && current.length === 0) return null;
  // Las elegidas primero y, para el dueño, el resto
  const list = isOwner ? [...current, ...options.filter((o) => !current.some((c) => c.id === o.id))] : current;

  async function toggle(id: string, on: boolean) {
    const before = value;
    const next = on ? [...value, id] : value.filter((k) => k !== id);
    setValue(next);
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/characters/${characterId}/masteries`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masteries: next.map(refFromKey), partial: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setValue(before);
        setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
      router.refresh();
    } catch {
      setValue(before);
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Maestría con armas" className="animate-fade-up">
      <SectionBar title="Maestría con armas" extra={`${value.length}/${allowed}`} />
      {error && <p role="alert" className="mt-1 px-3 text-xs text-danger">{error}</p>}
      <ul className="mt-1 max-h-72 divide-y divide-line overflow-y-auto print:max-h-none">
        {list.map((o) => {
          const on = value.includes(o.id);
          return (
            <li key={o.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${on ? "" : "print:hidden"}`}>
              {isOwner && (
                <label className={`${switchTrack} print:hidden`}>
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={on}
                    disabled={saving || (!on && value.length >= allowed)}
                    aria-label={`Maestría con ${o.label}`}
                    onChange={(e) => toggle(o.id, e.target.checked)}
                  />
                  <span aria-hidden="true" className={switchThumb} />
                </label>
              )}
              <span className="font-semibold text-white">{o.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
