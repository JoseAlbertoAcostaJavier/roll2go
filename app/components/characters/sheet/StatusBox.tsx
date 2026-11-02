"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DefenseKind, DefenseRow } from "@/lib/rules/dnd2024/derive";
import MaskIcon from "@/app/components/ui/MaskIcon";
import { CONDITION_NAMES, defenseTypeName } from "@/lib/rules/dnd2024/sheet/labels";
import { exhaustionEffect } from "@/lib/rules/dnd2024/sheet/conditions";
import { iconSrc } from "@/lib/utils/icons";
import ConditionsDialog from "./ConditionsDialog";
import { statButton } from "./statUi";
import type { ShowStat, StatusState } from "./types";

// Grupos de la caja de defensas, en el orden en que llegan las filas
export const DEFENSE_GROUPS: { kind: DefenseKind; title: string }[] = [
  { kind: "resist", title: "Resistencias" },
  { kind: "immune", title: "Inmunidades" },
  { kind: "vulnerable", title: "Vulnerabilidades" },
  { kind: "conditionImmune", title: "Inmunidad a estados" },
];
export const defenseLabel = (r: DefenseRow) => (r.type === null ? "a elegir" : defenseTypeName(r.kind, r.type));

const title = "mb-1 text-xs font-semibold uppercase tracking-wide text-muted";

// Defensas y estados: resistencias, inmunidades y vulnerabilidades; los estados activos (cada uno abre su texto) y el
// agotamiento. El dueño los gestiona en un diálogo y cada cambio se guarda al momento (optimista, con vuelta atrás si falla).
export default function StatusBox({ characterId, isOwner, defenses, status, show, className = "" }: {
  characterId: string; isOwner: boolean; defenses: DefenseRow[]; status: StatusState; show: ShowStat; className?: string;
}) {
  const router = useRouter();
  const [conditions, setConditions] = useState(status.conditions);
  const [exhaustion, setExhaustion] = useState(status.exhaustion);
  const [seen, setSeen] = useState(status);
  const [managing, setManaging] = useState<HTMLElement | null>(null);
  const [error, setError] = useState("");
  // Una sola petición a la vez: los cambios mientras hay una pendiente se ignoran
  const pending = useRef(false);

  // Si el servidor trae otro estado (tras refrescar), se adopta
  if (seen !== status) {
    setSeen(status);
    if (seen.conditions.join() !== status.conditions.join() || seen.exhaustion !== status.exhaustion) {
      setConditions(status.conditions);
      setExhaustion(status.exhaustion);
    }
  }

  async function save(body: object, apply: () => void, undo: () => void) {
    if (pending.current) return;
    pending.current = true;
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
      router.refresh();
    } catch (e) {
      undo();
      setError(e instanceof Error ? e.message : "No se pudo guardar el estado.");
    } finally {
      pending.current = false;
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

  return (
    <section aria-label="Defensas y estados" className={`rounded-lg border-2 border-brand/40 bg-panel p-4 ${className}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <h3 className={title}>Defensas</h3>
          {defenses.length === 0 ? (
            <p className="text-sm text-muted">Sin defensas</p>
          ) : (
            <button
              type="button"
              aria-haspopup="dialog"
              data-print="text"
              onClick={show({ kind: "defenses" })}
              className={`${statButton} block w-full space-y-1 rounded px-1 py-1 text-left text-sm`}
            >
              {DEFENSE_GROUPS.map((g) => {
                const rows = defenses.filter((r) => r.kind === g.kind);
                if (rows.length === 0) return null;
                return (
                  <span key={g.kind} className="block">
                    <span className="font-semibold">{g.title}: </span>
                    <span className="text-muted">{rows.map(defenseLabel).join(", ")}</span>
                  </span>
                );
              })}
            </button>
          )}
        </div>

        <div className="min-w-0">
          <h3 className={title}>Estados</h3>
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
                    className={`${statButton} flex w-full items-center gap-2 rounded px-1 py-1 text-left`}
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
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={(e) => setManaging(e.currentTarget)}
              className="mt-2 rounded-md border border-brand/50 px-3 py-1 text-xs font-semibold text-brand-soft transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand print:hidden"
            >
              Gestionar estados
            </button>
          )}
        </div>
      </div>

      {managing && (
        <ConditionsDialog
          conditions={conditions}
          exhaustion={exhaustion}
          onCondition={setCondition}
          onExhaustion={setLevel}
          error={error}
          onClose={() => setManaging(null)}
          opener={managing}
        />
      )}
    </section>
  );
}
