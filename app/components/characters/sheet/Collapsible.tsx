"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Cabecera pulsable (botón con `aria-expanded`) y contenido plegado por defecto. `aside` (p. ej. los usos de un rasgo)
// queda fuera del botón, siempre visible, para que pulsarlo no despliegue. El contenido sigue en el DOM plegado
// (`hidden print:block`): la impresión lo saca desplegado y sin chevron. El estado no se guarda.
export default function Collapsible({ header, aside, children, className = "" }: {
  header: ReactNode; aside?: ReactNode; children: ReactNode; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-start gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-brand-soft print:cursor-text"
      >
        <span className="min-w-0 flex-1">{header}</span>
        <ChevronDown size={16} aria-hidden="true" className={`mt-1 shrink-0 text-muted transition-transform print:hidden ${open ? "rotate-180" : ""}`} />
      </button>
      {aside}
      <div id={id} className={`mt-2 ${open ? "" : "hidden print:block"}`}>{children}</div>
    </div>
  );
}
