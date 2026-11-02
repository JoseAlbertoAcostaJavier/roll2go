"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// Texto largo recortado a ~8 líneas (`max-h-48`) con degradado y «Ver más» / «Ver menos». El botón solo aparece si
// el contenido realmente se recorta; al imprimir sale completo y sin botón.
export default function ClampedText({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Solo se mide recortado: abierto, el contenido siempre cabe
    const measure = () => { if (!open) setOverflows(el.scrollHeight > el.clientHeight + 1); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, children]);

  const clamped = overflows && !open;
  return (
    <div>
      <div
        ref={ref}
        id={id}
        className={`relative ${open ? "" : "max-h-48 overflow-hidden"} print:max-h-none print:overflow-visible`}
      >
        {children}
        {clamped && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-panel to-transparent print:hidden" />
        )}
      </div>
      {overflows && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="mt-1 text-sm font-semibold text-brand-soft hover:text-white print:hidden"
        >
          {open ? "Ver menos" : "Ver más"}
        </button>
      )}
    </div>
  );
}
