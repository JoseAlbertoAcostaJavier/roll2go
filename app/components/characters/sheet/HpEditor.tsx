"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import MaskIcon from "@/app/components/ui/MaskIcon";
import { sheetUiSrc } from "@/lib/utils/icons";
import type { ReactNode } from "react";
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
    <div aria-hidden="true" className="flex h-1 overflow-hidden bg-surface print:hidden">
      <div className={`transition-[width] duration-300 ${color}`} style={{ width: `${(current / total) * 100}%` }} />
      {temp > 0 && <div className="bg-sky-400 transition-[width] duration-300" style={{ width: `${(temp / total) * 100}%` }} />}
    </div>
  );
}

const numberField =
  "h-12 w-14 rounded-md border border-line-strong bg-surface px-1 text-center font-heading text-lg font-bold text-white focus:border-brand focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none";
const bigField =
  "h-9 min-w-8 rounded border border-transparent bg-transparent px-1 text-center font-heading text-xl font-bold text-white hover:border-line focus:border-brand focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none";
const actionButton =
  "flex h-12 w-11 shrink-0 items-center justify-center bg-line/60 transition-colors enabled:hover:bg-line disabled:opacity-40";
const caption = "mt-1 text-center text-xs font-medium text-fg";

function Stepper({ label, value, max, onChange, big = false }: {
  label: string; value: number; max: number; onChange: (v: number) => void;
  /** Dentro del recuadro de actuales / máximos: mide lo que sus cifras */
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
      style={big ? { width: `calc(${Math.max(draft.length, 1)}ch + 0.75rem)` } : undefined}
    />
  );
}

// PG actuales y temporales del dueño: actualización optimista y vuelta atrás si el guardado falla
// `version` cambia cuando el personaje cambia en el servidor (descanso, borrar un nivel, otras cajas de la franja):
// si no hay cambios propios sin guardar, el editor adopta entonces los PG que llegan; si los hay, se quedan los suyos,
// salvo que los PG del servidor hayan cambiado por otra vía (un descanso): entonces ganan y el cambio pendiente se descarta
export default function HpEditor({ characterId, max, current, temp, version, rest }: {
  characterId: string; max: number; version: number;
  /** Botones de descanso, a la derecha de Daño y Curar. */
  rest?: ReactNode;
} & Hp) {
  const [hp, setHp] = useState<Hp>({ current: Math.min(current, max), temp });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("1");
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
    setAmount("1");
  };
  const damage = () => {
    const fromTemp = Math.min(hp.temp, delta);
    update({ temp: hp.temp - fromTemp, current: Math.max(0, hp.current - (delta - fromTemp)) });
    setAmount("1");
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 print:hidden">
        {/* Actuales / Máximos y Temporales */}
        <div className="grid min-w-56 flex-1 grid-cols-[minmax(10rem,1fr)_auto] gap-x-2">
          <div className="relative flex h-12 items-center justify-center gap-3 overflow-hidden rounded-md border border-line-strong bg-surface pb-1">
            <Stepper big label="PG actuales" value={hp.current} max={max} onChange={(v) => update({ current: v })} />
            <span aria-hidden="true" className="text-muted">/</span>
            <span className="min-w-8 text-center font-heading text-xl font-bold text-white"><span className="sr-only">máximos: </span>{max}</span>
            <div className="absolute inset-x-0 bottom-0"><HpBar current={hp.current} max={max} temp={hp.temp} /></div>
          </div>
          <Stepper label="PG temporales" value={hp.temp} max={MAX_TEMP_HP} onChange={(v) => update({ temp: v })} />
          <div aria-hidden="true" className="flex justify-center">
            <span className={`${caption} w-20`}>Actuales</span>
            <span className={`${caption} w-20`}>Máx.</span>
          </div>
          <span aria-hidden="true" className={caption}>Temp.</span>
        </div>
        {/* Daño · cantidad · Curar */}
        <div>
          <div className="flex overflow-hidden rounded-md border border-line-strong">
            <button type="button" aria-label="Daño" title="Daño" className={actionButton} onClick={damage} disabled={delta === 0 || (hp.current === 0 && hp.temp === 0)}>
              <MaskIcon src={sheetUiSrc("heart-minus")} size={20} className="text-brand-soft" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={amount}
              aria-label="Cantidad de curación o daño"
              onChange={(e) => setAmount(e.target.value)}
              className={`${numberField} rounded-none! border-0!`}
            />
            <button type="button" aria-label="Curar" title="Curar" className={actionButton} onClick={heal} disabled={delta === 0 || hp.current >= max}>
              <MaskIcon src={sheetUiSrc("heart-plus")} size={20} className="text-success" />
            </button>
          </div>
          <div aria-hidden="true" className="flex justify-between px-1">
            <span className={caption}>Daño</span>
            <span className={caption}>Curar</span>
          </div>
        </div>
        {rest && <div className="flex flex-col gap-1.5">{rest}</div>}
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
