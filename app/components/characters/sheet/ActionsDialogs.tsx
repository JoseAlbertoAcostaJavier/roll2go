"use client";

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { SpellOption } from "@/lib/rules/catalog/types";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { Ref } from "@/lib/rules/types";
import Bbcode from "@/app/components/ui/Bbcode";
import MaskIcon from "@/app/components/ui/MaskIcon";
import SpellDialog from "@/app/components/characters/spells/SpellDialog";
import { spellHrefFrom } from "@/app/components/characters/spells/SpellList";
import StatDialog from "./StatDialog";

/** Acción básica de combate para su diálogo: icono, nombre, cuánto cuesta y texto. */
export type BasicActionInfo = { key: string; name: string; icon: string | null; time: string; description: string };

/** Rasgo para su diálogo: nombre, origen y descripción de 5etools. */
export type FeatureInfo = { key: string; name: string; source: string; description: string };

type Ctx = {
  openSpell: (ref: Ref, from: HTMLElement) => void;
  openBasic: (key: string, from: HTMLElement) => void;
  openFeature: (key: string, from: HTMLElement) => void;
};
const ActionsContext = createContext<Ctx | null>(null);

function useActions(): Ctx {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("Fuera de ActionsDialogs");
  return ctx;
}

// Ficha de conjuro (la de la pestaña Conjuros, `?spell=`) y diálogos de las acciones básicas y de los rasgos de la
// pestaña Acciones.
// `active`: la pestaña está a la vista; si no, no se monta la ficha (la pestaña Conjuros tiene la suya).
export default function ActionsDialogs({ characterId, active, spells, basics, features, children }: {
  characterId: string;
  active: boolean;
  spells: SpellOption[];
  basics: BasicActionInfo[];
  features: FeatureInfo[];
  children: ReactNode;
}) {
  const byKey = useMemo(() => new Map(spells.map((s) => [refKey(s.ref), s])), [spells]);
  const spellOpener = useRef<HTMLElement | null>(null);
  const [basic, setBasic] = useState<{ info: BasicActionInfo; opener: HTMLElement } | null>(null);

  const [feature, setFeature] = useState<{ info: FeatureInfo; opener: HTMLElement } | null>(null);

  const ctx = useMemo<Ctx>(() => ({
    // Cambia `?spell=` sin recargar (SpellDialog lo lee) y recuerda quién la abrió
    openSpell: (ref, from) => {
      spellOpener.current = from;
      window.history.pushState(null, "", spellHrefFrom(window.location.search, ref));
    },
    openBasic: (key, from) => {
      const info = basics.find((b) => b.key === key);
      if (info) setBasic({ info, opener: from });
    },
    openFeature: (key, from) => {
      const info = features.find((f) => f.key === key);
      if (info) setFeature({ info, opener: from });
    },
  }), [basics, features]);

  return (
    <ActionsContext.Provider value={ctx}>
      {children}
      {active && <SpellDialog characterId={characterId} spells={byKey} opener={spellOpener} />}
      {basic && (
        <StatDialog title={basic.info.name} description="" onClose={() => setBasic(null)} opener={basic.opener}>
          <div className="mb-4 flex items-center gap-3 text-muted">
            <MaskIcon src={basic.info.icon} size={40} className="text-brand-soft" />
            <span className="text-sm font-semibold uppercase tracking-wide">{basic.info.time}</span>
          </div>
          {basic.info.description
            ? <Bbcode source={basic.info.description} className="text-sm" />
            : <p className="text-sm text-muted">Sin descripción.</p>}
        </StatDialog>
      )}
      {feature && (
        <StatDialog title={feature.info.name} description="" onClose={() => setFeature(null)} opener={feature.opener}>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{feature.info.source}</p>
          {feature.info.description
            ? <Bbcode source={feature.info.description} className="text-sm" />
            : <p className="text-sm text-muted">Sin descripción.</p>}
        </StatDialog>
      )}
    </ActionsContext.Provider>
  );
}

/** Nombre de un conjuro que abre su ficha (enlace propio: con Ctrl o en otra pestaña, la abre por la dirección). */
export function SpellLink({ spellRef, name }: { spellRef: Ref; name: string }) {
  const { openSpell } = useActions();
  const search = useSearchParams().toString();
  return (
    <a
      href={spellHrefFrom(search, spellRef)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        openSpell(spellRef, e.currentTarget);
      }}
      className="font-semibold text-fg hover:text-brand-soft hover:underline"
    >
      {name}
    </a>
  );
}

/** Nombre de una acción básica que abre su diálogo. */
export function BasicActionButton({ actionKey, name }: { actionKey: string; name: string }) {
  const { openBasic } = useActions();
  return (
    <button
      type="button"
      onClick={(e) => openBasic(actionKey, e.currentTarget)}
      className="font-semibold text-fg hover:text-brand-soft hover:underline"
    >
      {name}
    </button>
  );
}

/** Nombre de un rasgo que abre su descripción en un diálogo. */
export function FeatureButton({ featureKey, name }: { featureKey: string; name: string }) {
  const { openFeature } = useActions();
  return (
    <button
      type="button"
      onClick={(e) => openFeature(featureKey, e.currentTarget)}
      className="text-left font-semibold text-fg hover:text-brand-soft hover:underline"
    >
      {name}
    </button>
  );
}
