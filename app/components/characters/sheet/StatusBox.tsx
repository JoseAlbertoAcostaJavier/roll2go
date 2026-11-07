"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import type { DefenseKind, DefenseRow } from "@/lib/rules/dnd2024/derive";
import MaskIcon from "@/app/components/ui/MaskIcon";
import { CONDITION_NAMES, defenseTypeName } from "@/lib/rules/dnd2024/sheet/labels";
import { exhaustionEffect } from "@/lib/rules/dnd2024/sheet/conditions";
import { iconSrc } from "@/lib/utils/icons";
import { CONDITION_KEYS } from "@/lib/rules/dnd2024/sheet/status";
import ConditionsDialog from "./ConditionsDialog";
import MobileCollapse from "./MobileCollapse";
import { fieldBox, sheetSideBox, statButton, subLabel, tagChip } from "./statUi";
import type { ShowStat, StatusState } from "./types";

// Grupos de la caja de defensas, en el orden en que llegan las filas
export const DEFENSE_GROUPS: { kind: DefenseKind; title: string }[] = [
  { kind: "resist", title: "Resistencias" },
  { kind: "immune", title: "Inmunidades" },
  { kind: "vulnerable", title: "Vulnerabilidades" },
  { kind: "conditionImmune", title: "Inmunidad a estados" },
];
export const defenseLabel = (r: DefenseRow) => (r.type === null ? "a elegir" : defenseTypeName(r.kind, r.type));


// Dos cajas. Defensas: resistencias, vulnerabilidades e inmunidades. Estados: los activos (cada uno abre su texto) y el
// agotamiento; el dueño añade uno desde el desplegable o los gestiona en un diálogo, y cada cambio se guarda al momento
// (optimista, con vuelta atrás si falla).
export default function StatusBox({ characterId, isOwner, defenses, status, show }: {
  characterId: string; isOwner: boolean; defenses: DefenseRow[]; status: StatusState; show: ShowStat;
}) {
  const router = useRouter();
  const [conditions, setConditions] = useState(status.conditions);
  const [exhaustion, setExhaustion] = useState(status.exhaustion);
  const [seen, setSeen] = useState(status);
  const [managing, setManaging] = useState<HTMLElement | null>(null);
  const [error, setError] = useState("");
  // Una sola petición a la vez: los cambios mientras hay una pendiente se ignoran
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  // Ocupado: petición en curso o refresco de la página pendiente; no se adoptan props ni se aceptan cambios nuevos
  const busy = saving || refreshing;

  // Si el servidor trae otro estado (tras refrescar), se adopta
  if (seen !== status && !busy) {
    setSeen(status);
    if (seen.conditions.join() !== status.conditions.join() || seen.exhaustion !== status.exhaustion) {
      setConditions(status.conditions);
      setExhaustion(status.exhaustion);
    }
  }

  async function save(body: object, apply: () => void, undo: () => void) {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    apply();
    setError("");
    try {
      const res = await fetch(`/api/characters/${characterId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar el estado.");
      // La respuesta es el estado guardado: se adopta tal cual y el refresco solo sincroniza el resto de la página
      if (Array.isArray(data.status?.conditions) && typeof data.status?.exhaustion === "number") {
        setConditions(data.status.conditions);
        setExhaustion(data.status.exhaustion);
      }
      startRefresh(() => router.refresh());
    } catch (e) {
      undo();
      setError(e instanceof Error ? e.message : "No se pudo guardar el estado.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const setCondition = (key: string, active: boolean) => {
    const before = conditions;
    const next = active ? [...before, key] : before.filter((k) => k !== key);
    return save({ op: "condition", key, active }, () => setConditions(next), () => setConditions(before));
  };
  const setLevel = (level: number) => {
    const before = exhaustion;
    return save({ op: "exhaustion", level }, () => setExhaustion(level), () => setExhaustion(before));
  };

  const hasStatus = conditions.length > 0 || exhaustion > 0;

  const available = CONDITION_KEYS.filter((k) => k !== "exhaustion" && !conditions.includes(k));

  return (
    <>
    <section aria-label="Defensas" className={sheetSideBox}>
      <MobileCollapse title="Defensas">
        <div className="space-y-2">
          {DEFENSE_GROUPS.map((g) => {
            const rows = defenses.filter((r) => r.kind === g.kind);
            return (
              <div key={g.kind}>
                <p className={subLabel}>{g.title}</p>
                {rows.length === 0 ? <div className={fieldBox} /> : (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    data-print="text"
                    onClick={show({ kind: "defenses" })}
                    className={`${statButton} ${fieldBox} w-full text-left`}
                  >
                    {rows.map((r, i) => <span key={`${r.kind}-${r.type}-${i}`} className={tagChip}>{defenseLabel(r)}</span>)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </MobileCollapse>
    </section>

    <section aria-label="Estados" className={`${sheetSideBox} relative`}>
      {isOwner && (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label="Gestionar estados"
          title="Gestionar estados"
          onClick={(e) => setManaging(e.currentTarget)}
          className="absolute right-9 top-2 z-10 rounded p-1 text-muted transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-brand md:right-2 print:hidden"
        >
          <Settings size={16} aria-hidden="true" />
        </button>
      )}
      <MobileCollapse title="Estados">
        {!hasStatus && <p className="text-sm text-muted">Sin estados</p>}
        {hasStatus && (
          <ul className="space-y-1 text-sm">
            {conditions.map((k) => (
              <li key={k}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  data-print="text"
                  onClick={show({ kind: "condition", key: k })}
                  className={`${statButton} flex w-full items-center gap-2 rounded px-1 py-1 text-left font-semibold`}
                >
                  <MaskIcon src={iconSrc("condition", k)} size={16} className="text-brand-soft print:hidden" />
                  {CONDITION_NAMES[k] ?? k}
                </button>
              </li>
            ))}
            {exhaustion > 0 && (
              <li className="flex items-start gap-2 px-1 py-1">
                <MaskIcon src={iconSrc("condition", "exhaustion")} size={16} className="mt-0.5 text-brand-soft print:hidden" />
                <span>
                  <span className="font-semibold">Agotamiento {exhaustion}</span>
                  <span className="block text-xs text-muted">{exhaustionEffect(exhaustion)}</span>
                </span>
              </li>
            )}
          </ul>
        )}
        {isOwner && (
          <select
            aria-label="Añadir estado"
            value=""
            disabled={busy}
            onChange={(e) => e.target.value && setCondition(e.target.value, true)}
            className="mt-2 w-full border-b border-line-strong bg-panel py-1 text-sm text-fg focus:border-brand focus:outline-none disabled:opacity-50 print:hidden"
          >
            <option value="">Añadir estado</option>
            {available.map((k) => <option key={k} value={k}>{CONDITION_NAMES[k] ?? k}</option>)}
          </select>
        )}
        {error && !managing && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
      </MobileCollapse>
    </section>

      {managing && (
        <ConditionsDialog
          conditions={conditions}
          exhaustion={exhaustion}
          onCondition={setCondition}
          onExhaustion={setLevel}
          error={error}
          busy={busy}
          onClose={() => setManaging(null)}
          opener={managing}
        />
      )}
    </>
  );
}
