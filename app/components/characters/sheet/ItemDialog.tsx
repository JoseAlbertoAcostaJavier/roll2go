"use client";

import Bbcode from "@/app/components/ui/Bbcode";
import type { ItemDetails } from "@/lib/rules/dnd2024/sheet/itemDetails";
import StatDialog from "./StatDialog";

// Ficha de un objeto del inventario: tipo y rareza, datos y la descripción del catálogo. Mismo comportamiento que
// StatDialog (foco atrapado, Escape cierra, el foco vuelve al nombre que la abrió).
export default function ItemDialog({ details, description, onClose, opener }: {
  details: ItemDetails;
  description: string;
  onClose: () => void;
  opener: HTMLElement | null;
}) {
  return (
    <StatDialog title={details.name} description="" onClose={onClose} opener={opener}>
      {details.subtitle && <p className="mb-3 text-sm text-muted">{details.subtitle}</p>}
      {details.rows.length > 0 && (
        <dl className="mb-4 divide-y divide-line text-sm">
          {details.rows.map((r) => (
            <div key={r.label} className="flex gap-3 py-1.5">
              <dt className="w-28 shrink-0 font-semibold text-muted">{r.label}</dt>
              <dd className="min-w-0 flex-1 wrap-break-word">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {description.trim()
        ? <Bbcode source={description} className="text-sm" />
        : <p className="text-sm text-muted">Sin descripción.</p>}
    </StatDialog>
  );
}
