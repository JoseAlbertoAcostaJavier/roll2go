"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, LoaderCircle, Minus, Plus, Swords } from "lucide-react";
import { MAX_TEMP_HP } from "@/lib/rules/dnd2024/sheet/edits";

type Hp = { current: number; temp: number };

// Espera entre pulsaciones antes de guardar, para enviar una sola petición por ráfaga de clics
const SAVE_DELAY = 600;
const clamp = (v: number, max: number) => Math.min(max, Math.max(0, Math.trunc(v) || 0));
const sameHp = (a: Hp, b: Hp) => a.current === b.current && a.temp === b.temp;

/** Evento de ventana que lanza un descanso hecho: el editor descarta los PG que aún no ha enviado. */
export const REST_EVENT = "roll2go:rest";

// Barra de vida: los PG actuales en verde, amarillo o rojo según lo que queda y, a continuación, los temporales
export function HpBar({ current, max, temp }: Hp & { max: number }) {
  const total = Math.max(max, current + temp, 1);
  const ratio = max > 0 ? current / max : 0;
  const color = ratio <= 0.25 ? "bg-brand" : ratio <= 0.5 ? "bg-yellow-500" : "bg-success";
  return (
    <div aria-hidden="true" className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-surface print:hidden">
      <div className={`transition-[width] duration-300 ${color}`} style={{ width: `${(current / total) * 100}%` }} />
      {temp > 0 && <div className="bg-sky-400 transition-[width] duration-300" style={{ width: `${(temp / total) * 100}%` }} />}
    </div>
  );
}

const stepButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface transition-colors enabled:hover:border-brand enabled:hover:text-white disabled:opacity-40";
const numberField =
  "h-8 w-16 rounded-md border border-line-strong bg-surface px-1 text-center font-heading font-bold focus:border-brand focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none";
const bigField =
  "h-11 min-w-8 rounded-md border border-transparent bg-transparent px-1 text-center font-heading text-4xl font-extrabold text-white hover:border-line focus:border-brand focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none";
const actionButton =
  "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border bg-surface px-2.5 text-xs font-bold transition-colors disabled:opacity-50 sm:flex-none";

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
        // Grande, mide lo que sus cifras: la barra «/ máximos» queda pegada al número
        style={big ? { width: `calc(${Math.max(draft.length, 1)}ch + 0.75rem)` } : undefined}
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
// si no hay cambios propios sin guardar, el editor adopta entonces los PG que llegan; si los hay, se quedan los suyos,
// salvo que los PG del servidor hayan cambiado por otra vía (un descanso): entonces ganan y el cambio pendiente se descarta
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

  // PG del servidor vistos por última vez y los últimos que envió este editor, para saber si un cambio es ajeno
  const [seenVersion, setSeenVersion] = useState(version);
  const [seenHp, setSeenHp] = useState<Hp>({ current: Math.min(current, max), temp });
  const [sentHp, setSentHp] = useState<Hp | null>(null);
  // Cada vez que un cambio ajeno anula el propio pendiente, sube: el efecto de abajo cancela el envío
  const [discarded, setDiscarded] = useState(0);
  if (seenVersion !== version) {
    setSeenVersion(version);
    const incoming = { current: Math.min(current, max), temp };
    setSeenHp(incoming);
    // Un descanso (u otro cambio ajeno a este editor) gana a lo que el editor aún no ha enviado
    const external = !sameHp(incoming, seenHp) && !(sentHp && sameHp(incoming, sentHp));
    if (!dirty || external) {
      setHp(incoming);
      if (dirty) {
        setDirty(false);
        setDiscarded((n) => n + 1);
      }
    }
  }
  useEffect(() => {
    if (discarded === 0) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    unsent.current = null;
  }, [discarded]);
  // Un descanso no siempre cambia los PG guardados (si el cambio propio aún no se había enviado, el servidor ya estaba
  // al máximo), así que lo avisa con un evento: se descarta lo pendiente y el refresco trae los PG del descanso
  useEffect(() => {
    const onRest = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      unsent.current = null;
      setDirty(false);
    };
    window.addEventListener(REST_EVENT, onRest);
    return () => window.removeEventListener(REST_EVENT, onRest);
  }, []);

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
    setSentHp(next);
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
    <div>
      <div className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-baseline">
            <Stepper big label="PG actuales" value={hp.current} max={max} onChange={(v) => update({ current: v })} />
            <span className="ml-1 font-heading text-xl font-bold text-muted">/ <span className="sr-only">máximos: </span>{max}</span>
            {hp.temp > 0 && <span className="ml-2 font-heading text-base font-bold text-sky-400">+{hp.temp}</span>}
          </div>
          {/* Cantidad · Curar · Daño */}
          <div className="flex w-full items-center gap-1.5 sm:w-auto">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={amount}
              placeholder="Cant."
              aria-label="Cantidad de curación o daño"
              onChange={(e) => setAmount(e.target.value)}
              className={`${numberField} h-9! w-14! shrink-0 placeholder:text-xs placeholder:font-normal placeholder:text-muted`}
            />
            <button type="button" className={`${actionButton} border-success/50 text-success enabled:hover:bg-success/10`} onClick={heal} disabled={delta === 0 || hp.current >= max}>
              <Heart size={13} aria-hidden="true" /> Curar
            </button>
            <button type="button" className={`${actionButton} border-brand/60 text-brand-soft enabled:hover:bg-brand/15`} onClick={damage} disabled={delta === 0 || (hp.current === 0 && hp.temp === 0)}>
              <Swords size={13} aria-hidden="true" /> Daño
            </button>
          </div>
        </div>
        <HpBar current={hp.current} max={max} temp={hp.temp} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Temporales</p>
          <Stepper label="PG temporales" value={hp.temp} max={MAX_TEMP_HP} onChange={(v) => update({ temp: v })} />
        </div>
      </div>
      {/* Impresión: solo el texto */}
      <p className="hidden font-heading text-2xl font-extrabold print:block">
        {hp.current}
        <span className="text-base font-bold text-muted"> / {max}</span>
        {hp.temp > 0 && <span className="ml-1 text-base text-success">+{hp.temp}</span>}
      </p>
      {saving && <LoaderCircle size={14} aria-label="Guardando" className="mx-auto mt-1 animate-spin text-muted print:hidden" />}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
