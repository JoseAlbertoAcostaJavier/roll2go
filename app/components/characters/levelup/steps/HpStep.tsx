"use client";

import { useEffect, useRef, useState } from "react";
import { Dices, Heart, LoaderCircle, Scale } from "lucide-react";
import type { HpPick } from "../state";

// Como `averageHitDie` del servidor (validateLevel, que no se puede importar aquí): mitad hacia abajo + 1
const averageHitDie = (die: number) => Math.floor(die / 2) + 1;
const fmtMod = (m: number) => (m >= 0 ? `+ ${m}` : `− ${-m}`);
// La animación dura al menos esto aunque el servidor responda antes
const ROLL_MS = 700;
const FACE_MS = 70;

const option = (active: boolean) =>
  `flex flex-1 basis-40 items-center justify-center gap-2 rounded-md border px-4 py-3 font-heading font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
    active ? "border-brand bg-brand/10 text-white" : "border-line bg-surface enabled:hover:border-brand"
  }`;

/* Puntos de golpe del nivel: la media del dado o una tirada firmada por el servidor (con animación). Una vez tirado,
   el resultado queda fijado para este nivel. */
export default function HpStep({ characterId, die, value, onChange, conMod, preview }: {
  characterId: string;
  die: number;
  value: HpPick | null;
  onChange: (v: HpPick) => void;
  conMod: number;
  /** PG máximos antes y después con lo elegido (null hasta elegir). */
  preview: { before: number; after: number } | null;
}) {
  const avg = averageHitDie(die);
  const rolled = value?.method === "roll" ? value : null;
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState<number | null>(null);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function roll() {
    setRolling(true);
    setError("");
    timer.current = setInterval(() => setFace(1 + Math.floor(Math.random() * die)), FACE_MS);
    const started = Date.now();
    try {
      const res = await fetch("/api/dice/hit-die", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, die }),
      });
      const data = await res.json().catch(() => null);
      await new Promise((r) => setTimeout(r, Math.max(0, ROLL_MS - (Date.now() - started))));
      if (!res.ok || typeof data?.value !== "number" || typeof data?.token !== "string") {
        setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
      onChange({ method: "roll", value: data.value, token: data.token, die });
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      setFace(null);
      setRolling(false);
    }
  }

  // Lo que suben los PG máximos; además del dado y la CON pueden contar la especie, una dote o una CON mejorada
  const base = value ? value.value + conMod : 0;
  const gained = preview ? preview.after - preview.before : base;
  const extra = gained - base;
  const shown = rolling ? face : value?.value ?? null;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Lanza 1d{die} y anota el resultado, o toma la media ({avg}). A los puntos de golpe del dado se suma tu modificador
        de Constitución. Si tiras, el resultado queda fijado para este nivel.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={option(value?.method === "average")}
          disabled={rolling || !!rolled}
          aria-pressed={value?.method === "average"}
          onClick={() => onChange({ method: "average", value: avg, die })}
        >
          <Scale size={18} aria-hidden="true" /> Media ({avg})
        </button>
        <button
          type="button"
          className={option(!!rolled)}
          disabled={rolling || !!rolled}
          aria-pressed={!!rolled}
          onClick={roll}
        >
          {rolling ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Dices size={18} aria-hidden="true" />}
          Lanzar d{die}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-brand-soft">{error}</p>}

      <div className="flex flex-wrap items-center gap-5 rounded-md border border-line bg-surface p-4">
        <span
          key={rolling ? "rolling" : `${value?.method}-${value?.value}`}
          aria-live="polite"
          className={`flex h-16 w-16 items-center justify-center rounded-lg border-2 font-heading text-3xl font-extrabold ${
            rolling ? "animate-pulse border-brand text-muted" : shown !== null ? "animate-pop border-brand text-white" : "border-line text-muted"
          }`}
        >
          {shown ?? "?"}
        </span>
        <div className="min-w-0 text-sm">
          {value && !rolling ? (
            <>
              <p className="font-heading text-lg font-bold">
                +{gained} <span className="text-sm font-normal text-muted">({value.value} {fmtMod(conMod)} CON{extra ? ` ${fmtMod(extra)} otros rasgos` : ""})</span>
              </p>
              {preview && (
                <p className="flex items-center gap-1 text-muted">
                  <Heart size={14} aria-hidden="true" className="text-brand-soft" />
                  {preview.before} → <span className="font-semibold text-fg">{preview.after} PG</span>
                </p>
              )}
              {rolled && <p className="mt-1 text-xs text-muted">Tirada hecha: no se puede repetir.</p>}
            </>
          ) : (
            <p className="text-muted">{rolling ? "Tirando…" : "Elige la media o lanza el dado."}</p>
          )}
        </div>
      </div>
    </div>
  );
}
