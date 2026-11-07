"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Minus, Settings } from "lucide-react";
import { CampaignDialog } from "@/app/components/campaigns/CharacterActions";
import { CONDITION_KEYS } from "@/lib/rules/dnd2024/sheet/status";
import type { CustomCondition } from "@/lib/rules/dnd2024/sheet/sheet";
import type { DefenseKind, DefenseRow } from "@/lib/rules/dnd2024/derive";
import MaskIcon from "@/app/components/ui/MaskIcon";
import useDismiss from "@/app/components/ui/useDismiss";
import { CONDITION_NAMES, defenseTypeName } from "@/lib/rules/dnd2024/sheet/labels";
import { exhaustionEffect } from "@/lib/rules/dnd2024/sheet/conditions";
import { iconSrc } from "@/lib/utils/icons";
import { MANUAL_DEFENSE_SOURCE, defenseTypes } from "@/lib/rules/dnd2024/sheet/custom";
import ConditionsDialog from "./ConditionsDialog";
import MobileCollapse from "./MobileCollapse";
import { customOp } from "./OrderedSection";
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


// Dos cajas. Defensas: resistencias, vulnerabilidades e inmunidades; el dueño añade las suyas desde un desplegable en cada
// recuadro. Estados: los activos (cada uno abre su texto) y el agotamiento; el dueño los gestiona en un diálogo y cada cambio
// se guarda al momento (optimista, con vuelta atrás si falla).
// Un recuadro de defensas: etiquetas con lo que tiene y, para el dueño, un desplegable con todos los tipos. Las calculadas
// salen marcadas y no se pueden quitar desde aquí (vienen de la especie, una dote o un objeto).
function DefenseField({ kind, title: label, rows, characterId, isOwner, show }: {
  kind: DefenseKind; title: string; rows: DefenseRow[]; characterId: string; isOwner: boolean; show: ShowStat;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, open, () => setOpen(false));
  const manual = (r: DefenseRow | undefined) => !!r?.sources.includes(MANUAL_DEFENSE_SOURCE);
  const computed = (r: DefenseRow | undefined) => !!r && r.sources.some((s) => s !== MANUAL_DEFENSE_SOURCE);

  async function toggle(type: string, active: boolean) {
    setBusy(true);
    const message = await customOp(characterId, { op: "defense", kind, type, active });
    setBusy(false);
    setError(message ?? "");
    if (!message) router.refresh();
  }

  const chips = rows.map((r, i) => <span key={`${r.type}-${i}`} className={tagChip}>{defenseLabel(r)}</span>);
  return (
    <div ref={box} className="relative">
      <p className={subLabel}>{label}</p>
      {isOwner ? (
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${label}: añadir o quitar`}
          onClick={() => setOpen((o) => !o)}
          data-print="text"
          className={`${fieldBox} w-full cursor-pointer text-left transition-colors hover:border-line-strong ${open ? "border-brand" : ""}`}
        >
          {chips}
        </button>
      ) : rows.length === 0 ? <div className={fieldBox} /> : (
        <button type="button" aria-haspopup="dialog" data-print="text" onClick={show({ kind: "defenses" })} className={`${statButton} ${fieldBox} w-full text-left`}>{chips}</button>
      )}
      {open && (
        <ul role="listbox" aria-multiselectable="true" aria-label={label} className="absolute right-0 top-full z-40 mt-1 max-h-72 w-52 animate-pop overflow-y-auto rounded-lg border border-line-strong bg-panel py-1 shadow-lg print:hidden">
          {defenseTypes(kind).map((type) => {
            const row = rows.find((r) => r.type === type);
            const on = !!row;
            const fixed = computed(row) && !manual(row);
            return (
              <li key={type} role="option" aria-selected={on}>
                <button
                  type="button"
                  disabled={busy || fixed}
                  title={fixed ? `De: ${row!.sources.join(", ")}` : undefined}
                  onClick={() => toggle(type, !manual(row))}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm font-semibold text-fg transition-colors enabled:hover:bg-surface disabled:text-muted"
                >
                  {defenseTypeName(kind, type)}
                  {on && <Check size={14} strokeWidth={3} aria-hidden="true" className="shrink-0 text-brand-soft" />}
                </button>
              </li>
            );
          })}
          {error && <li role="alert" className="px-3 py-1 text-xs text-danger">{error}</li>}
        </ul>
      )}
    </div>
  );
}

type RemoveTarget = { type: "condition"; key: string } | { type: "custom"; id: string } | { type: "exhaustion" };

export default function StatusBox({ characterId, isOwner, defenses, status, show, customConditions }: {
  characterId: string; isOwner: boolean; defenses: DefenseRow[]; status: StatusState; show: ShowStat;
  /** Estados creados por el jugador. */
  customConditions: CustomCondition[];
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

  const activeCustom = customConditions.filter((c) => c.active);
  const hasStatus = conditions.length > 0 || exhaustion > 0 || activeCustom.length > 0;

  // Añadir desde el desplegable y quitar con su «−» (con confirmación)
  const [adding, setAdding] = useState(false);
  const addBox = useRef<HTMLDivElement>(null);
  useDismiss(addBox, adding, () => setAdding(false));
  const [removing, setRemoving] = useState<{ name: string; target: RemoveTarget; opener: HTMLElement } | null>(null);
  function confirmRemove(target: RemoveTarget) {
    setRemoving(null);
    if (target.type === "condition") void setCondition(target.key, false);
    else if (target.type === "custom") void customRun({ op: "conditionActive", id: target.id, active: false });
    else void setLevel(0);
  }
  const customRun = async (op: object) => {
    const message = await customOp(characterId, op);
    setError(message ?? "");
    if (!message) router.refresh();
    return message;
  };
  const available = [
    ...CONDITION_KEYS.filter((k) => !conditions.includes(k)).map((k) => ({ id: k, label: CONDITION_NAMES[k] ?? k, add: () => void setCondition(k, true) })),
    ...customConditions.filter((c) => !c.active).map((c) => ({ id: c.id, label: c.name, add: () => void customRun({ op: "conditionActive", id: c.id, active: true }) })),
  ].sort((a, b) => a.label.localeCompare(b.label, "es"));
  const removeButton = (name: string, target: RemoveTarget) => isOwner && (
    <button
      type="button"
      aria-label={`Quitar ${name}`}
      title="Quitar"
      onClick={(e) => setRemoving({ name, target, opener: e.currentTarget })}
      className="mr-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft/80 text-surface opacity-0 transition-opacity hover:bg-brand-soft focus-visible:opacity-100 group-hover/cond:opacity-100 max-md:opacity-100 print:hidden"
    >
      <Minus size={12} strokeWidth={3} aria-hidden="true" />
    </button>
  );

  return (
    <>
    <section aria-label="Defensas" className={sheetSideBox}>
      <MobileCollapse title="Defensas">
        <div className="space-y-2">
          {DEFENSE_GROUPS.map((g) => (
            <DefenseField key={g.kind} kind={g.kind} title={g.title} rows={defenses.filter((r) => r.kind === g.kind)} characterId={characterId} isOwner={isOwner} show={show} />
          ))}
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
              <li key={k} className="group/cond flex items-center">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  data-print="text"
                  onClick={show({ kind: "condition", key: k })}
                  className={`${statButton} flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left font-semibold`}
                >
                  <MaskIcon src={iconSrc("condition", k)} size={16} className="text-brand-soft print:hidden" />
                  {CONDITION_NAMES[k] ?? k}
                </button>
                {removeButton(CONDITION_NAMES[k] ?? k, { type: "condition", key: k })}
              </li>
            ))}
            {activeCustom.map((c) => (
              <li key={c.id} className="group/cond flex items-center">
                <span title={c.description || undefined} className="min-w-0 flex-1 px-1 py-1 font-semibold">
                  {c.name}
                  {c.description && <span className="block text-xs font-normal text-muted">{c.description}</span>}
                </span>
                {removeButton(c.name, { type: "custom", id: c.id })}
              </li>
            ))}
            {exhaustion > 0 && (
              <li className="group/cond flex items-start gap-2 px-1 py-1">
                <MaskIcon src={iconSrc("condition", "exhaustion")} size={16} className="mt-0.5 text-brand-soft print:hidden" />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">Agotamiento {exhaustion}</span>
                  <span className="block text-xs text-muted">{exhaustionEffect(exhaustion)}</span>
                </span>
                {removeButton(`Agotamiento ${exhaustion}`, { type: "exhaustion" })}
              </li>
            )}
          </ul>
        )}
        {isOwner && (
          <div ref={addBox} className="relative mt-2 print:hidden">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={adding}
              disabled={busy}
              onClick={() => setAdding((a) => !a)}
              className="flex w-full items-center justify-between border-b border-line-strong py-1 text-left text-sm font-semibold text-muted transition-colors hover:text-white disabled:opacity-50"
            >
              Añadir estado
              <ChevronDown size={16} aria-hidden="true" className={adding ? "rotate-180" : ""} />
            </button>
            {adding && (
              <ul role="listbox" aria-label="Añadir estado" className="absolute bottom-full left-0 right-0 z-40 mb-1 max-h-72 animate-pop overflow-y-auto rounded-lg border border-line-strong bg-panel py-1 shadow-lg">
                {available.map((o) => (
                  <li key={o.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        o.add();
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm font-semibold text-fg transition-colors hover:bg-surface"
                    >
                      {o.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
          customConditions={customConditions}
          onCreate={(name, description) => customRun({ op: "addCondition", name, description })}
          onCustomActive={(id, active) => void customRun({ op: "conditionActive", id, active })}
          onCustomDelete={(id) => void customRun({ op: "removeCondition", id })}
        />
      )}

      {removing && (
        <CampaignDialog title="¿Quitar el estado?" opener={removing.opener} onClose={() => setRemoving(null)}>
          <p className="mb-5 text-sm text-muted">Se quitará {removing.name} de este personaje.</p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" data-autofocus onClick={() => setRemoving(null)} className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-white">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => confirmRemove(removing.target)}
              className="rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-hover"
            >
              Sí, quitar
            </button>
          </div>
        </CampaignDialog>
      )}
    </>
  );
}
