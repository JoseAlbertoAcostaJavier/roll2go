"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronsUp, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import DeleteCharacter from "./DeleteCharacter";

const item =
  "flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm outline-none hover:bg-surface focus-visible:bg-surface";

// Acciones rápidas de la tarjeta de personaje: subir de nivel, editar y borrar. Se cierra con Escape, al pulsar fuera y al elegir;
// las flechas recorren las opciones.
export default function CharacterCardMenu({ characterId, characterName, canLevelUp }: {
  characterId: string;
  characterName: string;
  canLevelUp: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const focusButton = useCallback(() => button.current?.focus(), []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  }

  return (
    <div ref={root} className="absolute right-1.5 top-1.5 z-20" {...(open ? { "data-menu-open": "" } : {})}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Acciones de ${characterName}`}
        title="Acciones"
        onClick={() => setOpen((o) => !o)}
        className="flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-fg"
      >
        <EllipsisVertical size={18} aria-hidden="true" />
      </button>
      {/* El diálogo vive fuera del menú abierto: si estuviera dentro, se desmontaría al cerrarlo */}
      <DeleteCharacter
        characterId={characterId}
        characterName={characterName}
        onClosed={focusButton}
        trigger={(openDialog) => open && (
          <div
            ref={menu}
            role="menu"
            aria-label={`Acciones de ${characterName}`}
            onKeyDown={onKeyDown}
            className="absolute right-0 top-10 w-44 animate-pop rounded-md border border-line-strong bg-panel p-1 shadow-[0_12px_30px_rgba(0,0,0,0.5)]"
          >
            {canLevelUp && (
              <Link role="menuitem" href={`/characters/${characterId}/level-up`} className={item}>
                <ChevronsUp size={15} aria-hidden="true" /> Subir de nivel
              </Link>
            )}
            <Link role="menuitem" href={`/characters/${characterId}/edit`} className={item}>
              <Pencil size={15} aria-hidden="true" /> Editar
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                openDialog();
              }}
              className={`${item} text-danger`}
            >
              <Trash2 size={15} aria-hidden="true" /> Borrar
            </button>
          </div>
        )}
      />
    </div>
  );
}
