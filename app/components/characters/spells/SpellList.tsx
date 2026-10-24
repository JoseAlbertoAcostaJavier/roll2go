"use client";

import { useId, type ReactNode } from "react";
import { Clock, Crosshair, Hourglass, Lock, Shapes, WandSparkles, type LucideIcon } from "lucide-react";
import type { SpellOption } from "@/lib/rules/catalog";
import { refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import { spellLevelLabel, spellSchoolName } from "@/lib/rules/dnd2024/spellText";
import type { Ref } from "@/lib/rules/types";
import { SCHOOL_ICONS } from "@/app/components/icons/schools";

export type SpellRowItem = {
  ref: Ref;
  /** Nombre guardado, por si el conjuro no está en el catálogo. */
  name: string;
  spell: SpellOption | null;
  /** Origen de un conjuro siempre preparado («Dominio de la vida», «Dote: Iniciado en la magia»). */
  origin?: string;
  /** Casilla de preparar; sin ella la fila no la muestra. `reason`: por qué está desactivada. */
  check?: { checked: boolean; disabled: boolean; reason?: string; onChange: () => void };
  /** Atenuada (nivel demasiado alto para la clase). */
  dimmed?: boolean;
  /** Botón u otra acción al final de la fila. */
  action?: ReactNode;
};

/** Abre la ficha de un conjuro; `from`: el elemento pulsado, que recupera el foco al cerrarla. */
export type SpellOpener = (ref: Ref, from: HTMLElement) => void;

/** Enlace propio de la ficha de un conjuro. */
export const spellHref = (ref: Ref) => `?tab=conjuros&spell=${encodeURIComponent(refKey(ref))}`;

function Meta({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  if (!value) return null;
  return (
    <span className="flex min-w-0 items-center gap-1" title={label}>
      <Icon size={12} aria-hidden="true" className="shrink-0" />
      <span className="sr-only">{label}: </span>
      {value}
    </span>
  );
}

// Fila de un conjuro: casilla (si se puede preparar), icono de escuela, nombre (abre su ficha), nivel y escuela, tiempo,
// alcance, duración, componentes y el resumen
function Row({ item, onOpen }: { item: SpellRowItem; onOpen: SpellOpener }) {
  const s = item.spell;
  const Icon = s ? SCHOOL_ICONS[s.data.school] : undefined;
  const name = s ? (s.nameEs ?? s.name) : item.name;
  const checkId = useId();

  return (
    <li className={`flex gap-3 py-3 ${item.dimmed ? "opacity-50" : ""}`}>
      {item.check && (
        <span className="pt-0.5" title={item.check.disabled ? item.check.reason : undefined}>
          <input
            id={checkId}
            type="checkbox"
            className="h-4 w-4 accent-brand disabled:cursor-not-allowed"
            checked={item.check.checked}
            disabled={item.check.disabled}
            onChange={item.check.onChange}
            aria-label={`${item.check.checked ? "Dejar de preparar" : "Preparar"} ${name}`}
            aria-describedby={item.check.disabled && item.check.reason ? `${checkId}-why` : undefined}
          />
          {item.check.disabled && item.check.reason && <span id={`${checkId}-why`} className="sr-only">{item.check.reason}</span>}
        </span>
      )}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface text-brand-soft">
        {Icon ? <Icon size={20} /> : <WandSparkles size={18} aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <a
            href={spellHref(item.ref)}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              onOpen(item.ref, e.currentTarget);
            }}
            className="font-semibold text-fg hover:text-brand-soft hover:underline"
          >
            {name}
          </a>
          {s && (
            <span className="text-xs text-muted">
              {spellLevelLabel(s.data.level)} · {spellSchoolName(s.data.school)}
              {s.data.ritual && " · Ritual"}
            </span>
          )}
          {item.origin && (
            <span className="flex items-center gap-1 rounded border border-line px-1.5 text-[11px] text-muted">
              <Lock size={10} aria-hidden="true" /> {item.origin}
            </span>
          )}
        </div>
        {s && (
          <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
            <Meta label="Tiempo" value={s.data.time} icon={Clock} />
            <Meta label="Alcance" value={s.data.range} icon={Crosshair} />
            <Meta label="Duración" value={s.data.duration} icon={Hourglass} />
            <Meta label="Componentes" value={s.data.components} icon={Shapes} />
          </p>
        )}
        {s?.summary && <p className="mt-1 line-clamp-2 text-sm text-fg/80">{s.summary}</p>}
      </div>
      {item.action && <div className="shrink-0 self-center">{item.action}</div>}
    </li>
  );
}

// Lista de conjuros de la pestaña Conjuros
export default function SpellList({ items, empty, onOpen }: {
  items: SpellRowItem[];
  empty: string;
  onOpen: SpellOpener;
}) {
  if (items.length === 0) return <p className="py-3 text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((it) => <Row key={refKey(it.ref)} item={it} onOpen={onOpen} />)}
    </ul>
  );
}
