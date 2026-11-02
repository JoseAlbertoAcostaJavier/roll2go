"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CastOption } from "@/lib/rules/dnd2024/spells/castOptions";

const button =
  "flex items-center gap-1 rounded-md border border-brand px-2.5 py-1 text-xs font-semibold text-white transition-colors enabled:hover:bg-brand disabled:cursor-not-allowed disabled:border-line disabled:text-muted";

/**
 * Botón Lanzar de una fila (spec de la tabla de conjuros §2.3): con una opción, la ejecuta; con varias, abre un menú.
 * Sin opciones queda desactivado («Sin espacios libres»). El menú (`role="menu"`) toma el foco y se cierra con Escape.
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

  // El menú es `fixed` para no quedar recortado por el desplazamiento horizontal de la tabla: se cierra si algo se mueve
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    const close = () => setOpen(false);
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
  }, [open]);

  if (options.length === 0) {
    return <button type="button" disabled title="Sin espacios libres" aria-label={`Lanzar ${name}`} className={button}>Lanzar</button>;
  }
  if (options.length === 1) {
    return (
      <button
        type="button"
        aria-disabled={disabled || undefined}
        aria-label={`Lanzar ${name}`}
        title={options[0].label}
        onClick={() => {
          // aria-disabled en vez de disabled: el botón no pierde el foco mientras se espera al servidor
          if (!disabled) onCast(options[0]);
        }}
        className={button}
      >
        Lanzar
      </button>
    );
  }

  function toggle() {
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
      setOpen(false);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`Lanzar ${name}`}
        onClick={toggle}
        className={button}
      >
        Lanzar <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
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
        </div>
      )}
    </>
  );
}
