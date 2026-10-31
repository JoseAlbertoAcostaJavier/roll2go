"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RoundIcon from "@/app/components/ui/RoundIcon";
import type { SpellOption } from "@/lib/rules/catalog/types";
import type { SpellsSummary } from "@/lib/rules/dnd2024/derive";
import { bareName, refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { SpellOp } from "@/lib/rules/dnd2024/spells/spellOps";
import { card } from "@/app/components/ui/formStyles";
import CasterBlockView from "./CasterBlockView";
import SlotsBar from "./SlotsBar";
import SpellDialog from "./SpellDialog";
import SpellList, { spellHref, type SpellOpener } from "./SpellList";

type Props = {
  characterId: string;
  isOwner: boolean;
  initial: SpellsSummary;
  /** Por bloque (`libro:clave` de su clase): identificador de su lista de conjuros y de su icono. */
  lists: Record<string, { listId: string; iconId: string }>;
  /** Conjuros que tiene el personaje y, con la pestaña abierta, los de las listas de sus clases, sin descripción. */
  spells: SpellOption[];
};

// Pestaña Conjuros (spec de conjuros §4.1): espacios comunes, un bloque por clase lanzadora y «Otros». Las
// operaciones van una a una a PATCH /spells, que responde con el estado recalculado.
export default function SpellsTab({ characterId, isOwner, initial, lists, spells }: Props) {
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
    window.history.pushState(null, "", spellHref(ref));
  };

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
