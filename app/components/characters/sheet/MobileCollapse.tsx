"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { boxTitle } from "./statUi";

// Título y contenido de una caja de la ficha. Por debajo de `md` (donde la ficha pasa a una columna) el título es un
// botón con `aria-expanded` y el contenido va plegado; desde `md`, y al imprimir, el título es un encabezado y el
// contenido se ve siempre. Todo se decide con CSS, así que no hay desajuste de hidratación. El estado no se guarda.
export default function MobileCollapse({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <h3 className={`${boxTitle} mb-3 hidden md:block print:block`}>{title}</h3>
      <h3 className={`${boxTitle} md:hidden print:hidden ${open ? "mb-3" : ""}`}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 py-1 text-left focus-visible:outline-2 focus-visible:outline-brand-soft"
        >
          {title}
          <ChevronDown size={18} aria-hidden="true" className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </h3>
      <div id={id} className={`${open ? "" : "hidden"} md:block print:block`}>{children}</div>
    </>
  );
}
