"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RoundIcon from "@/app/components/ui/RoundIcon";
import type { SpellOption } from "@/lib/rules/catalog/types";
import type { SpellsSummary } from "@/lib/rules/dnd2024/derive";
import { bareName, refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import type { CastOption } from "@/lib/rules/dnd2024/spells/castOptions";
import type { SpellOp } from "@/lib/rules/dnd2024/spells/spellOps";
import type { SpellRow } from "@/lib/rules/dnd2024/spells/spellTable";
import {
  EMPTY_SPELL_TABLE_FILTER, parseSpellTableFilter, spellTableHref, spellViewHref,
} from "@/lib/rules/dnd2024/spells/spellTableFilter";
import { card } from "@/app/components/ui/formStyles";
import CasterBlockView from "./CasterBlockView";
import SlotsBar from "./SlotsBar";
import SpellDialog from "./SpellDialog";
import SpellList, { type SpellOpener } from "./SpellList";
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
  /** Parámetros de la dirección: filtros de la tabla y vista (`?vista=gestionar`). */
  query: Record<string, string | string[] | undefined>;
  /** Para sacar el modificador de cada lanzador de su ataque de conjuro. */
  proficiencyBonus: number;
};

// Pestaña Conjuros: por defecto la tabla por niveles con búsqueda, filtros y botón Lanzar (spec de la tabla de conjuros);
// con `?vista=gestionar`, la gestión (spec de conjuros §4.1): espacios comunes, un bloque por clase lanzadora y «Otros».
// Las operaciones van una a una a PATCH /spells, que responde con el estado recalculado.
export default function SpellsTab({ characterId, isOwner, initial, lists, spells, rows, query, proficiencyBonus }: Props) {
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

  // Aviso de un conjuro lanzado como ritual (no gasta nada, así que no pasa por el servidor)
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  function cast(row: SpellRow, option: CastOption) {
    if (option.kind === "ritual") {
      setNotice("Lanzado como ritual");
      return;
    }
    setNotice("");
    void send({ op: "slot", level: option.level, used: (state.used[option.level] ?? 0) + 1 });
  }

  const other = state.other.map((o) => {
    const spell = byKey.get(refKey(o.spell.ref)) ?? null;
    return { ref: o.spell.ref, name: o.spell.name || bareName(o.spell.ref.key), spell, origin: o.origin };
  });

  const manage = (Array.isArray(query.vista) ? query.vista[0] : query.vista) === "gestionar";
  const base = `/characters/${characterId}`;
  const filter = parseSpellTableFilter(query);
  const limitedUsed = Object.fromEntries(state.blocks.flatMap((b) => b.limited.map((l) => [l.key, l.used])));
  const hasSlots = Object.values(state.slots.levels).some((n) => n > 0) || !!state.slots.pact;
  const levels = [...new Set(rows.map((r) => r.level).filter((l) => l > 0))].sort((a, b) => a - b);
  const errorBox = error && (
    <p role="alert" className="animate-fade-in rounded-md border border-brand-soft/50 bg-surface p-3 text-sm text-brand-soft">{error}</p>
  );

  if (!manage) {
    return (
      <div className="space-y-4">
        {errorBox}
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="space-y-0.5 text-sm">
            {state.blocks.map((b) => (
              <p key={refKey(b.class)}>
                {state.blocks.length > 1 && <span className="font-heading font-bold">{b.name}: </span>}
                <span className="text-muted">Modificador </span><span className="font-heading font-bold">{fmtMod(b.attack - proficiencyBonus)}</span>
                <span className="text-muted"> · Ataque </span><span className="font-heading font-bold">{fmtMod(b.attack)}</span>
                <span className="text-muted"> · CD </span><span className="font-heading font-bold">{b.dc}</span>
              </p>
            ))}
          </div>
          <Link
            href={`${base}${spellViewHref(query, true)}`}
            scroll={false}
            className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:text-white print:hidden"
          >
            {isOwner ? "Gestionar conjuros" : "Ver lista"}
          </Link>
        </header>

        {notice && (
          <p role="status" className="animate-fade-in rounded-md border border-line bg-surface px-3 py-2 text-sm print:hidden">{notice}</p>
        )}

        <SpellTableFilters base={base} query={query} filter={filter} levels={levels} />
        {rows.length === 0 && (
          <p className="text-sm text-muted">
            Este personaje aún no tiene conjuros que lanzar{isOwner ? ". Prepáralos en «Gestionar conjuros»." : "."}
          </p>
        )}
        {/* Sin conjuros pero con espacios, la tabla muestra solo las casillas de cada nivel */}
        {(rows.length > 0 || hasSlots) && (
          <SpellTable
            rows={rows}
            filter={filter}
            slots={state.slots}
            used={state.used}
            limitedUsed={limitedUsed}
            isOwner={isOwner}
            busy={busy}
            onCast={cast}
            onSetSlot={(level, used) => void send({ op: "slot", level, used })}
            onSetLimited={(key, used) => void send({ op: "limited", key, used })}
            onOpen={open}
            clearHref={`${base}${spellTableHref(query, EMPTY_SPELL_TABLE_FILTER)}`}
          />
        )}

        <SpellDialog characterId={characterId} spells={byKey} opener={opener} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorBox}
      <div className="print:hidden">
        <Link
          href={`${base}${spellViewHref(query, false)}`}
          scroll={false}
          className="inline-block rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:text-white"
        >
          Volver a la tabla
        </Link>
      </div>

      <SlotsBar
        slots={state.slots}
        used={state.used}
        onSet={isOwner ? (level, used) => void send({ op: "slot", level, used }) : null}
        busy={busy}
      />

      {state.blocks.map((b) => (
        <CasterBlockView
          key={refKey(b.class)}
          block={b}
          listId={lists[refKey(b.class)]?.listId ?? ""}
          iconId={lists[refKey(b.class)]?.iconId ?? ""}
          spells={byKey}
          isOwner={isOwner}
          busy={busy}
          onOp={send}
          onOpen={open}
        />
      ))}

      {other.length > 0 && (
        <section className={`${card} animate-fade-up`} aria-labelledby="other-spells-title">
          <div className="mb-2 flex items-center gap-3">
            <RoundIcon kind="feature" id="others" label="Otros" size={40} />
            <h3 id="other-spells-title" className="font-heading text-xl font-bold">Otros</h3>
          </div>
          <p className="mb-2 text-sm text-muted">Conjuros de especie, legado, dotes y otros rasgos: siempre preparados.</p>
          <SpellList items={other} empty="" onOpen={open} />
        </section>
      )}

      {state.blocks.length === 0 && other.length === 0 && (
        <p className="text-sm text-muted">Este personaje aún no tiene conjuros.</p>
      )}

      <SpellDialog characterId={characterId} spells={byKey} opener={opener} />
    </div>
  );
}
