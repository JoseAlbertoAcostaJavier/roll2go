"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, Coffee, Hexagon, LoaderCircle } from "lucide-react";
import { CampaignDialog } from "@/app/components/campaigns/CharacterActions";
import { healingRange, type HitDicePool } from "@/lib/rules/dnd2024/sheet/rest";
import { HpBar, REST_EVENT } from "./HpEditor";

type Rest = "short" | "long";

const button =
  "flex h-8 items-center justify-center gap-1.5 rounded-md bg-line/60 px-3 text-xs font-semibold text-fg transition-colors hover:bg-line";
const secondary =
  "rounded-md border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors enabled:hover:text-white disabled:opacity-50";
const primary =
  "flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50";
const die = (on: boolean) =>
  `flex size-9 items-center justify-center rounded-full border transition-colors disabled:opacity-30 ${
    on ? "border-brand bg-brand/25 text-white" : "border-line-strong text-muted enabled:hover:border-fg enabled:hover:text-white"
  }`;

const TITLE: Record<Rest, string> = { long: "Descanso largo", short: "Descanso corto" };
const LONG_INTRO = "Un descanso largo es un periodo de al menos 8 horas: al menos 6 de sueño y no más de 2 de actividad ligera.";
const LONG_RECOVERY = "todos los puntos de golpe, los dados de golpe y los espacios de conjuro. Tu agotamiento baja en 1.";
const SHORT_INTRO = "Un descanso corto dura al menos 1 hora. Puedes gastar dados de golpe para recuperar puntos de golpe, o descansar sin gastarlos.";
const ALSO = "También recuperas los espacios de Magia de pacto y los usos que vuelven con un descanso corto.";

/** Botones «Descanso corto» y «Descanso largo» de la cabecera (solo el dueño). El largo pide confirmación; el corto
 *  abre un diálogo para gastar dados de golpe (con tirada de Roll2Go o con el total de una tirada física). Los aplica la
 *  ruta de descansos y la página se refresca con la hoja recuperada. */
export default function RestButtons({ characterId, pools, conMod, recoversOther, current, max }: {
  characterId: string; pools: HitDicePool[]; conMod: number; recoversOther: boolean;
  /** PG guardados, para el resumen del diálogo. */
  current: number; max: number;
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

  // Pulsar un dado marca hasta él; pulsar el último marcado lo quita
  const toggle = (p: HitDicePool, i: number) =>
    setSpend((s) => ({ ...s, [p.classKey]: (s[p.classKey] ?? 0) === i + 1 ? i : i + 1 }));

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
        <Coffee size={14} aria-hidden="true" /> Corto<span className="sr-only"> (descanso)</span>
      </button>
      <button type="button" onClick={show("long")} aria-haspopup="dialog" className={button}>
        <BedDouble size={14} aria-hidden="true" /> Largo<span className="sr-only"> (descanso)</span>
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
              {/* PG actuales y lo que se recupera */}
              <div className="mb-4">
                <div className="overflow-hidden rounded-md border border-line-strong">
                  <p className="flex justify-around py-1.5 font-heading text-lg font-bold text-white">
                    <span>{Math.min(current, max)}</span><span aria-hidden="true" className="text-muted">/</span><span>{max}</span>
                  </p>
                  <HpBar current={Math.min(current, max)} max={max} temp={0} />
                </div>
                <div aria-hidden="true" className="mt-1 flex justify-around text-xs font-semibold text-fg"><span>Actuales</span><span>Máximos</span></div>
              </div>
              {rest === "long" ? (
                <div className="mb-5 space-y-3 text-sm">
                  <p className="text-muted">{LONG_INTRO}</p>
                  <p><span className="font-semibold text-muted">Recuperas: </span>{LONG_RECOVERY}</p>
                </div>
              ) : (
                <div className="mb-5 space-y-4 text-sm">
                  <p className="text-muted">{SHORT_INTRO}</p>
                  <p>
                    <span className="font-semibold text-muted">Recuperas: </span>
                    {dice.length === 0 ? "0 puntos de golpe" : range.min === range.max ? `${range.min} puntos de golpe` : `entre ${range.min} y ${range.max} puntos de golpe`}
                  </p>
                  {pools.length > 0 && (
                    <ul className="space-y-3 border-t border-line pt-3">
                      {pools.map((p) => {
                        const free = p.total - p.used;
                        const n = spend[p.classKey] ?? 0;
                        return (
                          <li key={p.classKey} className="flex flex-wrap items-start justify-between gap-3">
                            <span>
                              <span className="block font-semibold text-white">{p.name}</span>
                              <span className="text-muted">{free}d{p.die}{conMod !== 0 ? (conMod > 0 ? `+${conMod}` : conMod) : ""}</span>
                            </span>
                            <span role="group" aria-label={`Dados de ${p.name} para gastar`} className="flex max-w-60 flex-wrap justify-end gap-1.5">
                              {Array.from({ length: p.total }, (_, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  disabled={i >= free}
                                  aria-pressed={i < n}
                                  aria-label={`Dado ${i + 1} de ${p.name}${i >= free ? ", ya gastado" : ""}`}
                                  onClick={() => toggle(p, i)}
                                  className={die(i < n)}
                                >
                                  <Hexagon size={18} aria-hidden="true" className={i < n ? "fill-brand" : ""} />
                                </button>
                              ))}
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
              {error && <p role="alert" className="mb-4 text-sm text-danger">{error}</p>}
              <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4">
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
