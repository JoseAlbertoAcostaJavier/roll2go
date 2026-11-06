"use client";

import { Minus, Plus, Star } from "lucide-react";
import Bbcode from "@/app/components/ui/Bbcode";
import MaskIcon from "@/app/components/ui/MaskIcon";
import { MAX_QUANTITY } from "@/lib/rules/dnd2024/sheet/edits";
import type { ItemDetails } from "@/lib/rules/dnd2024/sheet/itemDetails";
import { iconSrc } from "@/lib/utils/icons";
import { MoveMenu } from "./ManageInventory";
import StatDialog from "./StatDialog";

// Iconos a todo color (con su propio fondo), de /public: se pintan con <img>, no con MaskIcon
const ICONS = { weapon: "/assets/icons/Melee%20Weapons.svg", item: "/assets/icons/Items.svg" } as const;

/** Controles del dueño al pie de la ficha. Sin ellos (otros jugadores, o desde Acciones) la ficha es de solo lectura. */
export type ItemOwnerControls = {
  quantity: number;
  onQuantity: (quantity: number) => void;
  /** Destinos de «Mover» (`null` = Equipo); vacío = sin botón. */
  targets: { id: string | null; name: string }[];
  onMove: (to: string | null) => void;
  onRemove: () => void;
};

const stepButton =
  "flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted transition-colors hover:border-brand hover:text-white disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const smallButton =
  "rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted transition-colors hover:border-brand hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

// Ficha de un objeto del inventario, como en D&D Beyond: icono y nombre, tipo y ubicación en cursiva, datos con la
// etiqueta en negrita, descripción y maestría. Mismo comportamiento que StatDialog (foco atrapado, Escape cierra, el
// foco vuelve al nombre que la abrió).
export default function ItemDialog({ details, description, onClose, opener, owner }: {
  details: ItemDetails;
  description: string;
  onClose: () => void;
  opener: HTMLElement | null;
  owner?: ItemOwnerControls;
}) {
  // Con los controles del dueño la cantidad se edita al pie: no se repite en las filas
  const rows = owner ? details.rows.filter((r) => r.label !== "Cantidad") : details.rows;
  const header = (
    <span className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ICONS[details.icon]} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-md" />
      <span className="min-w-0 wrap-break-word">{details.name}</span>
    </span>
  );
  return (
    <StatDialog title={header} description="" onClose={onClose} opener={opener}>
      <p className="mb-3 text-sm italic text-muted">
        {[details.subtitle, details.location].filter(Boolean).join(" · ")}
      </p>
      {rows.length > 0 && (
        <dl className="mb-4 space-y-1 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-wrap gap-x-2">
              <dt className="font-bold">{r.label}:</dt>
              <dd className={`flex min-w-0 items-center gap-1.5 wrap-break-word ${r.label === "Fuente" ? "italic" : ""}`}>
                {r.icon && <MaskIcon src={iconSrc("damageType", r.icon)} size={16} className="text-muted" />}
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {description.trim()
        ? <Bbcode source={description} className="text-sm" />
        : <p className="text-sm text-muted">Sin descripción.</p>}

      {details.mastery && (
        <section className="mt-4 rounded-md border border-line bg-surface p-3 text-sm">
          <h4 className="mb-1 flex items-center gap-1.5 font-bold">
            <Star size={14} aria-hidden="true" className="fill-brand-soft text-brand-soft" />
            Maestría: {details.mastery.name}
          </h4>
          <p className="text-muted">{details.mastery.text}</p>
        </section>
      )}

      {owner && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <span className="text-sm font-bold">Cantidad</span>
          <div className="flex items-center gap-2">
            <button
              type="button" aria-label={`Quitar una unidad de ${details.name}`} className={stepButton}
              disabled={owner.quantity <= 0} onClick={() => owner.onQuantity(owner.quantity - 1)}
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <span className="min-w-6 text-center font-heading font-bold" aria-live="polite">{owner.quantity}</span>
            <button
              type="button" aria-label={`Añadir una unidad de ${details.name}`} className={stepButton}
              disabled={owner.quantity >= MAX_QUANTITY} onClick={() => owner.onQuantity(owner.quantity + 1)}
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>
          <span className="ml-auto flex items-center gap-2">
            {owner.targets.length > 0 && <MoveMenu name={details.name} targets={owner.targets} onMove={owner.onMove} />}
            <button
              type="button" aria-label={`Quitar ${details.name}`} className={smallButton}
              onClick={() => {
                owner.onRemove();
                onClose();
              }}
            >
              Quitar
            </button>
          </span>
        </div>
      )}
    </StatDialog>
  );
}
