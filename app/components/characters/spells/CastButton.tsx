"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import type { CastOption } from "@/lib/rules/dnd2024/spells/castOptions";

const button =
  "flex items-center gap-1 rounded-md border border-brand px-2.5 py-1 text-xs font-semibold text-white transition-colors not-aria-disabled:hover:bg-brand aria-disabled:cursor-not-allowed aria-disabled:border-line aria-disabled:text-muted disabled:cursor-not-allowed disabled:border-line disabled:text-muted";

/**
 * Botón Lanzar de una fila (spec de la tabla de conjuros §2.3): con una opción, la ejecuta; con varias, abre un menú.
 * Sin opciones queda desactivado («Sin espacios libres»). El menú (`role="menu"`) toma el foco y se cierra con Escape.
 * Es siempre el mismo `<button>` (solo cambian sus atributos) y se desactiva con `aria-disabled`: así no pierde el foco
 * ni al esperar al servidor ni cuando el gasto cambia el número de opciones.
 */
export default function CastButton({ options, onCast, disabled = false, name }: {
  options: CastOption[];
  onCast: (option: CastOption) => void;
  disabled?: boolean;
  /** Nombre del conjuro, para el nombre accesible. */
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const reasonId = useId();

  const none = options.length === 0;
  const multi = options.length > 1;
  const inert = none || disabled;
  // Si el gasto deja una sola opción (o ninguna), el menú abierto se cierra
  if (open && !multi) setOpen(false);
  const menuOpen = open && multi;

  // El menú es `fixed` para no quedar recortado por el desplazamiento horizontal de la tabla: se cierra si algo se mueve
  useEffect(() => {
    if (!menuOpen) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    // Si el foco está en el menú, que no se pierda al desmontarlo: vuelve al botón
    const close = () => {
      if (menu.current?.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true });
      setOpen(false);
    };
    const outside = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  function click() {
    if (inert) return;
    if (!multi) {
      onCast(options[0]);
      return;
    }
    const r = trigger.current?.getBoundingClientRect();
    // Hacia arriba si el menú (alto aproximado por opción) no cabe bajo el botón
    if (r) {
      const fits = r.bottom + 4 + options.length * 36 + 8 <= window.innerHeight;
      setPos(fits ? { top: r.bottom + 4, left: r.left } : { bottom: window.innerHeight - r.top + 4, left: r.left });
    }
    setOpen((o) => !o);
  }
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (step) {
      e.preventDefault();
      items[(at + step + items.length) % items.length]?.focus();
    } else if (e.key === "Tab") {
      // Sin preventDefault: el foco pasa al botón y el Tab sigue desde él (el menú está al final del documento)
      trigger.current?.focus();
      setOpen(false);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-disabled={inert || undefined}
        aria-haspopup={multi ? "menu" : undefined}
        aria-expanded={multi ? menuOpen : undefined}
        aria-controls={menuOpen ? id : undefined}
        aria-describedby={none ? reasonId : undefined}
        aria-label={`Lanzar ${name}`}
        title={none ? "Sin espacios libres" : options.length === 1 ? options[0].label : undefined}
        onClick={click}
        className={button}
      >
        Lanzar {multi && <ChevronDown size={12} aria-hidden="true" />}
      </button>
      {none && <span id={reasonId} className="sr-only">Sin espacios libres</span>}
      {/* En un portal: un antecesor con `transform` (las animaciones de entrada lo dejan puesto) haría de bloque
          contenedor del `fixed` y lo desplazaría */}
      {menuOpen && createPortal(
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={`Lanzar ${name}`}
          onKeyDown={onKeyDown}
          style={pos}
          className="fixed z-30 min-w-44 animate-fade-in rounded-md border border-line bg-panel p-1 shadow-lg"
        >
          {options.map((o) => (
            <button
              key={o.kind === "slot" ? o.level : "ritual"}
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onCast(o);
              }}
              className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-surface focus:bg-surface focus:outline-none"
            >
              {o.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
