"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, Coffee, LoaderCircle, Minus, Plus } from "lucide-react";
import { CampaignDialog } from "@/app/components/campaigns/CharacterActions";
import { healingRange, type HitDicePool } from "@/lib/rules/dnd2024/sheet/rest";
import { REST_EVENT } from "./HpEditor";

type Rest = "short" | "long";

const button =
  "flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold transition-colors hover:border-brand hover:text-white";
const secondary =
  "rounded-md border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors enabled:hover:text-white disabled:opacity-50";
const primary =
  "flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50";
const step =
  "flex size-8 items-center justify-center rounded-md border border-line text-muted transition-colors enabled:hover:border-brand enabled:hover:text-white disabled:opacity-40";

const TITLE: Record<Rest, string> = { long: "Descanso largo", short: "Descanso corto" };
const LONG_QUESTION = "¿Hacer un descanso largo? Recuperas todos los puntos de golpe, los dados de golpe y los espacios de conjuro, y tu agotamiento baja en 1.";
const SHORT_INTRO = "Un descanso corto dura al menos 1 hora. Puedes gastar dados de golpe para recuperar puntos de golpe.";
const ALSO = "También recuperas los espacios de Magia de pacto y los usos que vuelven con un descanso corto.";

/** Botones «Descanso corto» y «Descanso largo» de la cabecera (solo el dueño). El largo pide confirmación; el corto
 *  abre un diálogo para gastar dados de golpe (con tirada de Roll2Go o con el total de una tirada física). Los aplica la
 *  ruta de descansos y la página se refresca con la hoja recuperada. */
export default function RestButtons({ characterId, pools, conMod, recoversOther }: {
  characterId: string; pools: HitDicePool[]; conMod: number; recoversOther: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<{ rest: Rest; opener: HTMLElement } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [spend, setSpend] = useState<Record<string, number>>({});
  const [auto, setAuto] = useState(true);
  const [healing, setHealing] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const show = (rest: Rest) => (e: React.MouseEvent<HTMLButtonElement>) => {
    setError("");
    setSpend({});
    setAuto(true);
    setHealing("");
    setResult(null);
    setOpen({ rest, opener: e.currentTarget });
  };

  // Dados elegidos, en el orden de las clases (el servidor tira clase a clase en ese orden)
  const chosen = pools.map((p) => ({ pool: p, n: spend[p.classKey] ?? 0 })).filter((s) => s.n > 0);
  const dice = chosen.flatMap(({ pool, n }) => Array<number>(n).fill(pool.die));
  const range = healingRange(dice, conMod);

  const change = (p: HitDicePool, delta: number) =>
    setSpend((s) => ({ ...s, [p.classKey]: Math.min(p.total - p.used, Math.max(0, (s[p.classKey] ?? 0) + delta)) }));

  async function confirm(rest: Rest) {
    setLoading(true);
    setError("");
    try {
      const body = rest === "long"
        ? { op: "longRest" }
        : {
            op: "shortRest",
            spend: Object.fromEntries(chosen.map(({ pool, n }) => [pool.classKey, n])),
            ...(!auto && dice.length > 0 ? { healing: Number(healing) } : {}),
          };
      const res = await fetch(`/api/characters/${characterId}/rest`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
      // Los PG que el editor aún no ha enviado se calcularon antes del descanso: el descanso gana
      window.dispatchEvent(new Event(REST_EVENT));
      router.refresh();
      const rolls: number[] = Array.isArray(data?.rolls) ? data.rolls : [];
      if (rest === "short" && rolls.length > 0) {
        // Agrupa las tiradas por dado en el orden en que se gastaron
        const byDie = new Map<number, number[]>();
        dice.forEach((die, i) => byDie.set(die, [...(byDie.get(die) ?? []), rolls[i]]));
        const text = [...byDie].map(([die, r]) => `d${die}: ${r.join(", ")}`).join(", ");
        setResult(`Has recuperado ${data.healed} PG (${text}).`);
      } else {
        setOpen(null);
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  const rest = open?.rest;
  const manual = !auto && dice.length > 0;
  const healingValue = Number(healing);
  const healingValid = !manual || (healing.trim() !== "" && Number.isInteger(healingValue) && healingValue >= range.min && healingValue <= range.max);

  return (
    <>
      <button type="button" onClick={show("short")} aria-haspopup="dialog" className={button}>
        <Coffee size={16} aria-hidden="true" /> Descanso corto
      </button>
      <button type="button" onClick={show("long")} aria-haspopup="dialog" className={button}>
        <BedDouble size={16} aria-hidden="true" /> Descanso largo
      </button>

      {open && rest && (
        <CampaignDialog title={TITLE[rest]} opener={open.opener} onClose={() => !loading && setOpen(null)}>
          {result !== null ? (
            <>
              <p role="status" className="mb-5 text-sm">{result}</p>
              <div className="flex justify-end">
                <button type="button" data-autofocus onClick={() => setOpen(null)} className={secondary}>Cerrar</button>
              </div>
            </>
          ) : (
            <>
              {rest === "long" ? (
                <p className="mb-5 text-sm text-muted">{LONG_QUESTION}</p>
              ) : (
                <div className="mb-5 space-y-4 text-sm">
                  <p className="text-muted">{SHORT_INTRO}</p>
                  {pools.length > 0 && (
                    <ul className="space-y-2">
                      {pools.map((p) => {
                        const free = p.total - p.used;
                        const n = spend[p.classKey] ?? 0;
                        return (
                          <li key={p.classKey} className={`flex items-center justify-between gap-3 ${free === 0 ? "opacity-50" : ""}`}>
                            <span>
                              {p.name} (d{p.die}) <span className="text-muted">· te quedan {free} de {p.total}</span>
                            </span>
                            <span className="flex items-center gap-2">
                              <button type="button" className={step} disabled={free === 0 || n === 0} onClick={() => change(p, -1)} aria-label={`Un dado menos de ${p.name}`}>
                                <Minus size={14} aria-hidden="true" />
                              </button>
                              <output className="w-6 text-center font-bold" aria-label={`Dados de ${p.name}`}>{n}</output>
                              <button type="button" className={step} disabled={free === 0 || n >= free} onClick={() => change(p, 1)} aria-label={`Un dado más de ${p.name}`}>
                                <Plus size={14} aria-hidden="true" />
                              </button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {pools.length > 0 && (
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="size-4 accent-brand" />
                      Aplicar automáticamente la tirada
                    </label>
                  )}
                  {manual && (
                    <label className="block">
                      <span className="mb-1 block font-semibold">PG recuperados</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={range.min}
                        max={range.max}
                        value={healing}
                        onChange={(e) => setHealing(e.target.value)}
                        className="w-28 rounded-md border border-line-strong bg-surface px-3 py-2"
                        aria-describedby="rest-healing-range"
                      />
                      <span id="rest-healing-range" className="ml-3 text-muted">entre {range.min} y {range.max}</span>
                    </label>
                  )}
                  {recoversOther && <p className="text-muted">{ALSO}</p>}
                </div>
              )}
              {error && <p role="alert" className="mb-4 text-sm text-brand-soft">{error}</p>}
              <div className="flex flex-wrap justify-end gap-3">
                <button type="button" data-autofocus onClick={() => setOpen(null)} disabled={loading} className={secondary}>
                  Cancelar
                </button>
                <button type="button" onClick={() => confirm(rest)} disabled={loading || !healingValid} className={primary}>
                  {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
                  {rest === "long" ? TITLE.long : "Hacer descanso corto"}
                </button>
              </div>
            </>
          )}
        </CampaignDialog>
      )}
    </>
  );
}
