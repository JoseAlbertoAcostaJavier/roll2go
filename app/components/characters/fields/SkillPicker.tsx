"use client";

import { useEffect } from "react";
import { labelClass } from "@/app/components/formStyles";

/** `disabled`: motivo por el que no se puede elegir (p. ej. «Requiere nivel 5»); se muestra desactivada. */
export type PickerOption = { id: string; label: string; disabled?: string };

const select =
  "min-w-0 flex-1 basis-40 rounded-md border border-line bg-surface px-3 py-2.5 text-fg focus:border-brand focus:outline-none disabled:opacity-60";

/* Una fila de desplegables, uno por elección (habilidades, pericias, maestrías…). Lo elegido en uno no aparece en los
   demás. `value` guarda una posición por desplegable ("" = sin elegir). */
export default function SkillPicker({
  id, label, count, options, value, onChange, hint,
}: {
  id: string;
  label: string;
  count: number;
  /** Opciones disponibles (sin las que ya da otra fuente). */
  options: PickerOption[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Texto bajo la etiqueta (p. ej. «Ya tienes: Perspicacia (trasfondo)»). */
  hint?: string;
}) {
  const slots = Array.from({ length: count }, (_, i) => value[i] ?? "");
  const chosen = slots.filter(Boolean).length;

  // Lo elegido que ya no está entre las opciones (p. ej. una habilidad que ahora da el trasfondo) o que ya no se puede
  // elegir deja de estarlo. Sin opciones (aún cargando, o un borrador recuperado) no se toca nada.
  const valid = (v: string) => options.some((o) => o.id === v && !o.disabled);
  const stale = options.length > 0 && slots.some((v) => v && !valid(v));
  useEffect(() => {
    if (stale) onChange(slots.map((v) => (v && valid(v) ? v : "")));
  }, [stale]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(i: number, v: string) {
    const next = [...slots];
    next[i] = v;
    onChange(next);
  }

  return (
    // (min-w-0: un fieldset no encoge por debajo de su contenido y las opciones largas desbordan a 375 px)
    <fieldset className="min-w-0">
      <legend className={labelClass}>
        {label} <span className="font-normal text-muted">· elige {count} ({chosen}/{count})</span>
      </legend>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {slots.map((v, i) => (
          <select
            key={i}
            id={i === 0 ? id : `${id}-${i}`}
            aria-label={`${label} ${i + 1} de ${count}`}
            className={select}
            value={v}
            onChange={(e) => set(i, e.target.value)}
          >
            <option value="">Elige…</option>
            {options
              .filter((o) => o.id === v || !slots.includes(o.id))
              .map((o) => (
                <option key={o.id} value={o.id} disabled={!!o.disabled}>
                  {o.disabled ? `${o.label} — ${o.disabled}` : o.label}
                </option>
              ))}
          </select>
        ))}
      </div>
    </fieldset>
  );
}
