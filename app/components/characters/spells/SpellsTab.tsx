"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SpellOption } from "@/lib/rules/catalog/types";
import type { SpellsSummary } from "@/lib/rules/dnd2024/derive";
import type { SheetCustom } from "@/lib/rules/dnd2024/sheet/custom";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import type { SpellOp } from "@/lib/rules/dnd2024/spells/spellOps";
import type { SpellRow } from "@/lib/rules/dnd2024/spells/spellTable";
import { EMPTY_SPELL_TABLE_FILTER, parseSpellTableFilter, spellTableHref } from "@/lib/rules/dnd2024/spells/spellTableFilter";
import { switchThumb, switchTrack } from "../sheet/statUi";
import SpellBlockTools from "./SpellBlockTools";
import SpellDialog from "./SpellDialog";
import type { SpellOpener } from "./SpellList";
import SpellTable from "./SpellTable";
import SpellTableFilters from "./SpellTableFilters";

type Props = {
  characterId: string;
  isOwner: boolean;
  initial: SpellsSummary;
  /** Por bloque (`libro:clave` de su clase): identificador de su lista de conjuros y de su icono. */
  lists: Record<string, { listId: string; iconId: string }>;
  /** Conjuros que tiene el personaje y, con la pestaña abierta, los de las listas de sus clases, sin descripción. */
  spells: SpellOption[];
  /** Filas de la tabla (conjuros que puede lanzar), calculadas en el servidor. */
  rows: SpellRow[];
  /** Parámetros de la dirección: filtros de la tabla. */
  query: Record<string, string | string[] | undefined>;
  /** Para sacar el modificador de cada lanzador de su ataque de conjuro. */
  proficiencyBonus: number;
  custom: SheetCustom;
};

// Pestaña Conjuros: la tabla por niveles con búsqueda y filtros, donde también se preparan con su interruptor. Las
// operaciones van una a una a PATCH /spells, que responde con el estado recalculado.
export default function SpellsTab({ characterId, isOwner, initial, lists, spells, rows, query, proficiencyBonus, custom }: Props) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  // Un descanso (cabecera) o cualquier otro cambio del servidor trae un resumen nuevo: se adopta en vez del guardado
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setState(initial);
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preparedOnly, setPreparedOnly] = useState(false);
  const byKey = useMemo(() => new Map(spells.map((s) => [refKey(s.ref), s])), [spells]);

  async function send(op: SpellOp): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/characters/${characterId}/spells`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(op),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return false;
      }
      setState(data.spells as SpellsSummary);
      // Se refresca la página tras cada operación: recalcula lo que depende del servidor (p. ej. si el descanso corto
      // recupera algo) y, con otra tierra, trae conjuros que pueden no estar en la lista cargada (de otras clases).
      // El estado local ya está al día, así que no hay parpadeo
      router.refresh();
      return true;
    } catch {
      setError("No se pudo conectar con el servidor.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Abre la ficha del conjuro: cambia `?spell=` sin recargar (SpellDialog lo lee) y recuerda quién la abrió
  const opener = useRef<HTMLElement | null>(null);
  const open: SpellOpener = (ref, from) => {
    opener.current = from;
    // Conserva el resto de parámetros (filtros, vista) para que al cerrar la ficha se vuelva a lo mismo
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "conjuros");
    params.set("spell", refKey(ref));
    window.history.pushState(null, "", `?${params.toString()}`);
  };

  const prepare = (row: SpellRow, prepared: boolean) => {
    if (row.prepare) void send({ op: prepared ? "unprepare" : "prepare", class: row.prepare, ref: row.ref });
  };

  const base = `/characters/${characterId}`;
  const filter = parseSpellTableFilter(query);
  // (los de especie, legado y dotes solo están en `limitedUsed`)
  const limitedUsed: Record<string, number> = {
    ...state.limitedUsed,
    ...Object.fromEntries(state.blocks.flatMap((b) => b.limited.map((l) => [l.key, l.used]))),
  };
  const hasSlots = Object.values(state.slots.levels).some((n) => n > 0) || !!state.slots.pact;
  const levels = [...new Set(rows.map((r) => r.level).filter((l) => l > 0))].sort((a, b) => a - b);
  const errorBox = error && (
    <p role="alert" className="animate-fade-in rounded-md border border-danger/50 bg-surface p-3 text-sm text-danger">{error}</p>
  );

  const preparers = state.blocks.filter((b) => b.mode !== "levelUp" && b.preparedLimit > 0);
  const anyPrepared = preparers.some((b) => b.prepared.length > 0);
  const unprepareAll = async () => {
    for (const b of preparers) if (b.prepared.length > 0 && !(await send({ op: "unprepareAll", class: b.class }))) return;
  };

  return (
    <div className="space-y-4">
      {errorBox}
      <header className="flex flex-wrap items-center justify-end gap-x-3 gap-y-0.5 text-sm">
        {state.blocks.map((b) => (
          <p key={refKey(b.class)}>
            <span className="font-heading font-bold text-brand-soft">{b.name}</span>
            <span className="text-muted"> · CD </span><span className="font-heading font-bold text-white">{b.dc}</span>
            <span className="text-muted"> · Mod. </span><span className="font-heading font-bold text-white">{fmtMod(b.attack - proficiencyBonus)}</span>
            <span className="text-muted"> · Ataque </span><span className="font-heading font-bold text-white">{fmtMod(b.attack)}</span>
          </p>
        ))}
      </header>

      {rows.length > 0 && <SpellTableFilters base={base} query={query} filter={filter} levels={levels} />}

      {preparers.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 print:hidden">
          <label className="flex items-center gap-2 text-sm font-semibold text-fg">
            <span className={switchTrack}>
              <input type="checkbox" className="peer sr-only" checked={preparedOnly} onChange={(e) => setPreparedOnly(e.target.checked)} />
              <span aria-hidden="true" className={switchThumb} />
            </span>
            Solo preparados
          </label>
          {preparers.map((b) => (
            <span key={refKey(b.class)} title={`Preparados de ${b.name}`} className="rounded bg-surface px-2 py-0.5 text-xs font-bold text-fg" aria-live="polite">
              {preparers.length > 1 && `${b.name} `}{b.prepared.length}/{b.preparedLimit}
            </span>
          ))}
          {isOwner && (
            <button
              type="button"
              disabled={busy || !anyPrepared}
              onClick={() => void unprepareAll()}
              className="ml-auto rounded-md border border-brand/60 px-3 py-1.5 text-sm font-semibold text-fg transition-colors enabled:hover:bg-brand/15 disabled:opacity-40"
            >
              Desmarcar todos
            </button>
          )}
        </div>
      )}

      {state.blocks.map((b) => (
        <SpellBlockTools key={refKey(b.class)} block={b} listId={lists[refKey(b.class)]?.listId ?? ""} spells={byKey} isOwner={isOwner} busy={busy} onOp={send} />
      ))}

      {rows.length === 0 && !hasSlots && <p className="text-sm text-muted">Este personaje aún no tiene conjuros.</p>}
      {/* Sin conjuros pero con espacios, la tabla muestra solo las casillas de cada nivel */}
      {(rows.length > 0 || hasSlots) && (
        <SpellTable
          rows={rows}
          filter={filter}
          preparedOnly={preparedOnly}
          blocks={state.blocks}
          slots={state.slots}
          used={state.used}
          limitedUsed={limitedUsed}
          isOwner={isOwner}
          busy={busy}
          onPrepare={prepare}
          onSetSlot={(level, used) => void send({ op: "slot", level, used })}
          onSetLimited={(key, used) => void send({ op: "limited", key, used })}
          onOpen={open}
          clearHref={`${base}${spellTableHref(query, EMPTY_SPELL_TABLE_FILTER)}`}
          characterId={characterId}
          custom={custom}
        />
      )}

      <SpellDialog characterId={characterId} spells={byKey} opener={opener} />
    </div>
  );
}
