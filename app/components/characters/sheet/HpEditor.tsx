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

function Stepper({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
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
      <button type="button" className={stepButton} onClick={() => onChange(clamp(value - 1, max))} disabled={value <= 0} aria-label={`${label}: restar 1`}>
        <Minus size={14} aria-hidden="true" />
      </button>
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
        className={numberField}
      />
      <button type="button" className={stepButton} onClick={() => onChange(clamp(value + 1, max))} disabled={value >= max} aria-label={`${label}: sumar 1`}>
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

// PG actuales y temporales del dueño: actualización optimista y vuelta atrás si el guardado falla
export default function HpEditor({ characterId, max, current, temp }: { characterId: string; max: number } & Hp) {
  const [hp, setHp] = useState<Hp>({ current: Math.min(current, max), temp });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const saved = useRef<Hp>(hp);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const save = async (next: Hp) => {
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
    }
  };

  const update = (patch: Partial<Hp>) => {
    const next = { ...hp, ...patch };
    setHp(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(next), SAVE_DELAY);
  };

  return (
    <div className="space-y-2">
      <p className="font-heading text-2xl font-extrabold">
        {hp.current}
        <span className="text-base font-bold text-muted"> / {max}</span>
        {hp.temp > 0 && <span className="ml-1 text-base text-success">+{hp.temp}</span>}
        {saving && <LoaderCircle size={14} aria-label="Guardando" className="ml-1 inline animate-spin text-muted" />}
      </p>
      <div className="print:hidden">
        <Stepper label="PG actuales" value={hp.current} max={max} onChange={(v) => update({ current: v })} />
        <p className="mb-1 mt-2 text-xs uppercase tracking-wide text-muted">Temporales</p>
        <Stepper label="PG temporales" value={hp.temp} max={MAX_TEMP_HP} onChange={(v) => update({ temp: v })} />
      </div>
      {error && <p role="alert" className="text-xs text-brand-soft">{error}</p>}
    </div>
  );
}
