"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Minus, Plus } from "lucide-react";
import { MAX_TEMP_HP } from "@/lib/rules/dnd2024/sheet/edits";

type Hp = { current: number; temp: number };

// Espera entre pulsaciones antes de guardar, para enviar una sola petición por ráfaga de clics
const SAVE_DELAY = 600;
const clamp = (v: number, max: number) => Math.min(max, Math.max(0, Math.trunc(v) || 0));

const stepButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface transition-colors enabled:hover:border-brand enabled:hover:text-white disabled:opacity-40";
const numberField =
  "h-8 w-16 rounded-md border border-line bg-surface px-1 text-center font-heading font-bold focus:border-brand focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none";
const bigField =
  "h-12 w-16 rounded-md border border-transparent bg-transparent px-1 text-center font-heading text-3xl font-extrabold hover:border-line focus:border-brand focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none";
const actionButton =
  "h-8 w-full rounded-md border border-brand/60 bg-surface px-2 text-xs font-bold uppercase tracking-wide transition-colors enabled:hover:bg-brand-dark disabled:opacity-40";

function Stepper({ label, value, max, onChange, big = false }: {
  label: string; value: number; max: number; onChange: (v: number) => void;
  /** Solo el campo, grande (PG actuales); sin botones de ±1 */
  big?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  // Si el valor cambia desde fuera (botones o vuelta atrás), el campo lo refleja
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(String(value));
  }
  const commit = () => {
    const v = clamp(Number(draft), max);
    setDraft(String(v));
    if (v !== value) onChange(v);
  };
  return (
    <div className="flex items-center justify-center gap-1">
      {!big && (
        <button type="button" className={stepButton} onClick={() => onChange(clamp(value - 1, max))} disabled={value <= 0} aria-label={`${label}: restar 1`}>
          <Minus size={14} aria-hidden="true" />
        </button>
      )}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={draft}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className={big ? bigField : numberField}
      />
      {!big && (
        <button type="button" className={stepButton} onClick={() => onChange(clamp(value + 1, max))} disabled={value >= max} aria-label={`${label}: sumar 1`}>
          <Plus size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// PG actuales y temporales del dueño: actualización optimista y vuelta atrás si el guardado falla
// `version` cambia cuando el personaje cambia en el servidor (descanso, borrar un nivel, otras cajas de la franja):
// si no hay cambios propios sin guardar, el editor adopta entonces los PG que llegan; si los hay, se quedan los suyos
export default function HpEditor({ characterId, max, current, temp, version }: { characterId: string; max: number; version: number } & Hp) {
  const [hp, setHp] = useState<Hp>({ current: Math.min(current, max), temp });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const saved = useRef<Hp>(hp);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Último cambio aún sin enviar: si el editor se desmonta antes de que venza el temporizador, se envía al desmontar
  const unsent = useRef<Hp | null>(null);

  const [seenVersion, setSeenVersion] = useState(version);
  if (seenVersion !== version) {
    setSeenVersion(version);
    if (!dirty) {
      setHp({ current: Math.min(current, max), temp });
    }
  }

  // Sin cambios propios pendientes, lo mostrado es lo guardado en el servidor: a eso se vuelve si un guardado falla
  useEffect(() => {
    if (!dirty) saved.current = hp;
  }, [dirty, hp]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (unsent.current) {
      fetch(`/api/characters/${characterId}/hp`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(unsent.current),
        keepalive: true,
      }).catch(() => {});
    }
  }, [characterId]);

  const save = async (next: Hp) => {
    unsent.current = null;
    setSaving(true);
    try {
      const res = await fetch(`/api/characters/${characterId}/hp`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudieron guardar los PG.");
      saved.current = { current: data.hp.current, temp: data.hp.temp };
      setError("");
    } catch (e) {
      setHp(saved.current);
      setError(e instanceof Error ? e.message : "No se pudieron guardar los PG.");
    } finally {
      setSaving(false);
      // Si mientras tanto hay otro cambio esperando su temporizador, sigue sucio
      setDirty(timer.current !== null);
    }
  };

  const update = (patch: Partial<Hp>) => {
    const next = { ...hp, ...patch };
    setHp(next);
    setDirty(true);
    unsent.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      save(next);
    }, SAVE_DELAY);
  };

  // Curar suma hasta el máximo; Daño quita primero los temporales y el resto a los actuales (mínimo 0)
  const delta = clamp(Number(amount), Number.MAX_SAFE_INTEGER);
  const heal = () => {
    update({ current: Math.min(max, hp.current + delta) });
    setAmount("");
  };
  const damage = () => {
    const fromTemp = Math.min(hp.temp, delta);
    update({ temp: hp.temp - fromTemp, current: Math.max(0, hp.current - (delta - fromTemp)) });
    setAmount("");
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] items-center gap-x-3 gap-y-2 print:hidden">
        {/* Curar · cantidad · Daño */}
        <div className="space-y-1">
          <button type="button" className={actionButton} onClick={heal} disabled={delta === 0 || hp.current >= max}>Curar</button>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={amount}
            aria-label="Cantidad de curación o daño"
            onChange={(e) => setAmount(e.target.value)}
            className={`${numberField} w-full`}
          />
          <button type="button" className={actionButton} onClick={damage} disabled={delta === 0 || (hp.current === 0 && hp.temp === 0)}>Daño</button>
        </div>
        {/* Actuales / Máximos y Temporales */}
        <div>
          <div className="flex items-end justify-center gap-1">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted">Actuales</p>
              <Stepper big label="PG actuales" value={hp.current} max={max} onChange={(v) => update({ current: v })} />
            </div>
            <span className="pb-2 font-heading text-2xl text-muted" aria-hidden="true">/</span>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted">Máximos</p>
              <p className="flex h-12 w-16 items-center justify-center font-heading text-3xl font-extrabold">{max}</p>
            </div>
          </div>
          <div className="mt-1">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">Temporales</p>
            <Stepper label="PG temporales" value={hp.temp} max={MAX_TEMP_HP} onChange={(v) => update({ temp: v })} />
          </div>
        </div>
      </div>
      {/* Impresión: solo el texto */}
      <p className="hidden font-heading text-2xl font-extrabold print:block">
        {hp.current}
        <span className="text-base font-bold text-muted"> / {max}</span>
        {hp.temp > 0 && <span className="ml-1 text-base text-success">+{hp.temp}</span>}
      </p>
      {saving && <LoaderCircle size={14} aria-label="Guardando" className="mx-auto animate-spin text-muted print:hidden" />}
      {error && <p role="alert" className="text-xs text-brand-soft">{error}</p>}
    </div>
  );
}
