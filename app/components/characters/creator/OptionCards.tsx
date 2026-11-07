"use client";

import { Check } from "lucide-react";
import type { EntryOption } from "@/lib/rules/catalog/types";
import type { Ref } from "@/lib/rules/types";
import { bareName } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import RoundIcon from "../../ui/RoundIcon";

const sameRef = (a: Ref | null, b: Ref) => !!a && a.book === b.book && a.key === b.key;

/* Elección de clase o especie en tarjetas con su icono (botones de opción nativos: flechas del teclado y lector de
   pantalla incluidos). El `id` va en la opción que recibe el foco, para los enlaces de «Falta por completar». */
export default function OptionCards({ id, label, kind, options, value, onChange }: {
  id: string;
  label: string;
  kind: "class" | "species";
  options: EntryOption[];
  value: Ref | null;
  onChange: (ref: Ref) => void;
}) {
  const focusIndex = Math.max(options.findIndex((o) => sameRef(value, o.ref)), 0);
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      {options.length === 0 && <p className="text-sm text-muted">No hay opciones disponibles con los libros elegidos.</p>}
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((o, i) => {
          const selected = sameRef(value, o.ref);
          const name = o.nameEs ?? o.name;
          return (
            <label
              key={`${o.ref.book}:${o.ref.key}`}
              className={`relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-soft ${
                selected ? "border-brand bg-brand/10" : "border-line bg-surface/40 hover:border-line-strong hover:bg-surface"
              }`}
            >
              <input
                id={i === focusIndex ? id : undefined}
                type="radio"
                name={id}
                checked={selected}
                onChange={() => onChange(o.ref)}
                className="sr-only"
              />
              <RoundIcon kind={kind} id={bareName(o.ref.key)} label={name} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-heading text-sm font-bold text-white">{name}</span>
                {o.bookName && <span className="block truncate text-xs text-muted">{o.bookName}</span>}
              </span>
              {selected && <Check size={16} strokeWidth={3} aria-hidden="true" className="shrink-0 text-brand-soft" />}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
