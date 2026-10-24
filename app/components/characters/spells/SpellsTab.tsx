"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import type { SpellOption } from "@/lib/rules/catalog";
import type { SpellsSummary } from "@/lib/rules/dnd2024/derive";
import { bareName, refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import type { SpellOp } from "@/lib/rules/dnd2024/spellOps";
import type { Ref } from "@/lib/rules/types";
import { card } from "@/app/components/formStyles";
import CasterBlockView from "./CasterBlockView";
import SlotsBar from "./SlotsBar";
import SpellDialog from "./SpellDialog";
import SpellList, { spellHref } from "./SpellList";

type Props = {
  characterId: string;
  isOwner: boolean;
  /** Campaña del personaje, para pedir la ficha de un conjuro con sus libros. */
  campaignId: string | null;
  initial: SpellsSummary;
  /** Por bloque (`libro:clave` de su clase): identificador de su lista de conjuros y de su icono. */
  lists: Record<string, { listId: string; iconId: string }>;
  /** Conjuros de las listas de las clases y los que tiene el personaje, sin descripción. */
  spells: SpellOption[];
};

// Pestaña Conjuros (spec de conjuros §4.1): espacios comunes, un bloque por clase lanzadora y «Otros». Las
// operaciones van una a una a PATCH /spells, que responde con el estado recalculado.
export default function SpellsTab({ characterId, isOwner, campaignId, initial, lists, spells }: Props) {
  const [state, setState] = useState(initial);
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
      return true;
    } catch {
      setError("No se pudo conectar con el servidor.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Abre la ficha del conjuro: cambia `?spell=` sin recargar (SpellDialog lo lee)
  const open = (ref: Ref) => window.history.pushState(null, "", spellHref(ref));

  const other = state.other.map((o) => {
    const spell = byKey.get(refKey(o.spell.ref)) ?? null;
    return { ref: o.spell.ref, name: o.spell.name || bareName(o.spell.ref.key), spell, origin: o.origin };
  });

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="animate-fade-in rounded-md border border-brand-soft/50 bg-surface p-3 text-sm text-brand-soft">{error}</p>
      )}

      <SlotsBar
        slots={state.slots}
        used={state.used}
        onSet={isOwner ? (level, used) => void send({ op: "slot", level, used }) : null}
        onLongRest={isOwner ? () => void send({ op: "longRest" }) : null}
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
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface text-brand-soft">
              <Sparkles size={20} aria-hidden="true" />
            </span>
            <h3 id="other-spells-title" className="font-heading text-xl font-bold">Otros</h3>
          </div>
          <p className="mb-2 text-sm text-muted">Conjuros de especie, legado, dotes y otros rasgos: siempre preparados.</p>
          <SpellList items={other} empty="" onOpen={open} />
        </section>
      )}

      {state.blocks.length === 0 && other.length === 0 && (
        <p className="text-sm text-muted">Este personaje aún no tiene conjuros.</p>
      )}

      <SpellDialog spells={byKey} campaignId={campaignId} />
    </div>
  );
}
