"use client";

import { useEffect, useRef, useState } from "react";
import { Dices, LoaderCircle, Minus, Plus } from "lucide-react";
import { ABILITIES, type Ability } from "@/lib/rules/types";
import type { AbilityMethod } from "@/lib/rules/dnd2024/sheet";
import { POINT_BUY_TOTAL, STANDARD_ARRAY, checkBackgroundBonus, pointBuyCost } from "@/lib/rules/dnd2024/abilities";
import { assignValue, exceedsLimit, maxBase, totalsWithinLimit } from "@/lib/rules/dnd2024/assign";
import { field, labelClass } from "../formStyles";

type Base = Record<Ability, number | null>;
type Bonus = Partial<Record<Ability, number>>;
/** `valid` es false si alguna característica supera 20 en total (base + trasfondo). */
type Next = { method: AbilityMethod; base: Base; rolls: number[] | null; backgroundBonus: Bonus; valid: boolean };

const NAMES: Record<Ability, string> = {
  str: "Fuerza", dex: "Destreza", con: "Constitución", int: "Inteligencia", wis: "Sabiduría", cha: "Carisma",
};
const DESCRIPTIONS: Record<Ability, string> = {
  str: "Mide la potencia física y capacidades deportivas",
  dex: "Mide la agilidad y los reflejos",
  con: "Mide la resistencia y la salud",
  int: "Mide el razonamiento y la memoria",
  wis: "Mide la perspicacia e intuición",
  cha: "Mide la fuerza de personalidad y la presencia",
};
const METHODS: { id: AbilityMethod; label: string; column: string; help: string }[] = [
  {
    id: "pointBuy", label: "Reparto de puntos", column: "Reparto de puntos",
    help: "¡Siguiendo el manual! Tienes una cantidad de puntos para gastar en tus características. El precio en puntos es mayor para las puntuaciones más altas.",
  },
  {
    id: "roll", label: "Mediante tiradas", column: "Asigna tiradas",
    help: "¡Deja que los dados decidan! Se lanzan 4 dados de 6 caras y se descarta el más bajo. Se repite 6 veces y repartes los resultados entre las características.",
  },
  {
    id: "standard", label: "Valores predefinidos", column: "Asigna valores",
    help: "¡Sin complicaciones! Reparte estos valores fijos entre las características.",
  },
  {
    id: "manual", label: "Asignar manualmente", column: "Reparto manual",
    help: "¡Barra libre! Elige el valor de cada característica a mano.",
  },
];

const BONUS_POINTS = 3;
const emptyBase = (): Base => ({ str: null, dex: null, con: null, int: null, wis: null, cha: null });
const filledBase = (v: number): Base => ({ str: v, dex: v, con: v, int: v, wis: v, cha: v });
// Valores iniciales de cada método (el reparto de puntos parte de 8; el manual, de 10)
const freshBase = (m: AbilityMethod): Base => (m === "pointBuy" ? filledBase(8) : m === "manual" ? filledBase(10) : emptyBase());

const modOf = (total: number) => Math.floor((total - 10) / 2);
const fmtMod = (m: number) => (m > 0 ? `+${m}` : m < 0 ? `−${-m}` : "+0");
const modColor = (m: number) => (m > 0 ? "text-success" : m < 0 ? "text-brand-soft" : "text-muted");

const stepBtn =
  "flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface transition-colors enabled:hover:border-brand disabled:opacity-30";

const countOf = (list: (number | null)[], v: number) => list.filter((x) => x === v).length;

export default function AbilityScores({
  method, base, rolls, backgroundAbilities, backgroundBonus, onChange, onRequestRolls,
}: {
  method: AbilityMethod;
  /** Con `pointBuy`, un valor vacío se muestra como 8: el padre debería partir del valor por defecto del método. */
  base: Base;
  rolls: number[] | null;
  backgroundAbilities: Ability[];
  backgroundBonus: Bonus;
  /** Cada cambio informa también de `valid` (ningún total > 20). */
  onChange: (next: Next) => void;
  onRequestRolls: () => Promise<void>;
}) {
  const [pending, setPending] = useState<AbilityMethod | null>(null); // método pedido, a la espera de confirmar
  const [loadingRolls, setLoadingRolls] = useState(false);
  const [rollsError, setRollsError] = useState("");
  const [drag, setDrag] = useState<{ value: number; x: number; y: number } | null>(null);

  const emit = (patch: Partial<Omit<Next, "valid">>) => {
    const next = { method, base, rolls, backgroundBonus, ...patch };
    onChange({ ...next, valid: totalsWithinLimit(next.base, next.backgroundBonus) });
  };

  // Al llegar tiradas nuevas se vacían los valores repartidos
  const prevRolls = useRef(rolls);
  useEffect(() => {
    if (prevRolls.current === rolls) return;
    prevRolls.current = rolls;
    if (method === "roll") emit({ base: emptyBase() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolls]);
  const current = METHODS.find((m) => m.id === method)!;
  const usesPool = method === "roll" || method === "standard";
  const pool = method === "roll" ? (rolls ?? []) : method === "standard" ? STANDARD_ARRAY : [];
  const defaultValue = method === "pointBuy" ? 8 : null;
  const valueOf = (a: Ability) => base[a] ?? defaultValue;
  const assigned = ABILITIES.map(valueOf);

  // ---- cambio de método ----
  const hasValues =
    method === "pointBuy" ? assigned.some((v) => v !== null && v !== 8)
    : method === "manual" ? assigned.some((v) => v !== null && v !== 10)
    : assigned.some((v) => v !== null);

  function switchTo(m: AbilityMethod) {
    setPending(null);
    setRollsError("");
    emit({ method: m, base: freshBase(m) });
  }
  function requestMethod(m: AbilityMethod) {
    if (m === method) return;
    if (hasValues) setPending(m);
    else switchTo(m);
  }

  // ---- tiradas (las pide el padre al servidor y actualiza `rolls`) ----
  async function newRolls() {
    setLoadingRolls(true);
    setRollsError("");
    try {
      await onRequestRolls();
    } catch {
      setRollsError("No se pudieron obtener las tiradas. Inténtalo de nuevo.");
    } finally {
      setLoadingRolls(false);
    }
  }

  // ---- reparto de fichas ----
  // Si queda una ficha libre con ese valor se usa; si no, se intercambia con la casilla que lo tiene
  function place(ability: Ability, value: number) {
    const free = countOf(pool, value) - countOf(assigned, value);
    const taken = ABILITIES.some((a) => a !== ability && base[a] === value);
    if (taken && free > 0) emit({ base: { ...base, [ability]: value } });
    else emit({ base: assignValue(base, ability, value) });
  }
  function clear(ability: Ability) {
    emit({ base: { ...base, [ability]: null } });
  }

  // Arrastre con eventos pointer (ratón y táctil); se suelta sobre una casilla con data-ability
  const dragProps = (value: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ value, x: e.clientX, y: e.clientY });
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (drag) setDrag({ value: drag.value, x: e.clientX, y: e.clientY });
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      if (!drag) return;
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-ability]");
      const ability = target?.dataset.ability as Ability | undefined;
      setDrag(null);
      if (ability && ABILITIES.includes(ability)) place(ability, value);
    },
    onPointerCancel: () => setDrag(null),
    style: { touchAction: "none" as const },
  });

  // ---- reparto de puntos y manual ----
  const [min, max] = method === "pointBuy" ? [8, 15] : [3, 20];
  const scoresForCost = (override?: Partial<Record<Ability, number>>) =>
    Object.fromEntries(ABILITIES.map((a) => [a, override?.[a] ?? valueOf(a) ?? 8])) as Record<Ability, number>;
  const remaining = POINT_BUY_TOTAL - (method === "pointBuy" ? pointBuyCost(scoresForCost()) : 0);

  function step(a: Ability, delta: number) {
    const v = (valueOf(a) ?? 10) + delta;
    if (v < min || v > maxBase(max, backgroundBonus[a] ?? 0)) return;
    emit({ base: { ...base, [a]: v } });
  }
  function canIncrease(a: Ability) {
    const v = valueOf(a) ?? 10;
    if (v >= maxBase(max, backgroundBonus[a] ?? 0)) return false;
    return method !== "pointBuy" || pointBuyCost(scoresForCost({ [a]: v + 1 })) <= POINT_BUY_TOTAL;
  }

  // ---- trasfondo: 3 puntos, máximo +2 por característica ----
  const bonusLeft = BONUS_POINTS - ABILITIES.reduce((s, a) => s + (backgroundBonus[a] ?? 0), 0);
  function bonusStep(a: Ability, delta: number) {
    const v = (backgroundBonus[a] ?? 0) + delta;
    if (v < 0 || v > 2) return;
    const next = { ...backgroundBonus };
    if (v === 0) delete next[a];
    else next[a] = v;
    emit({ backgroundBonus: next });
  }
  const bonusValid = checkBackgroundBonus(backgroundBonus, backgroundAbilities);

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="ability-method" className={labelClass}>Método</label>
        <select
          id="ability-method"
          className={field}
          value={method}
          onChange={(e) => requestMethod(e.target.value as AbilityMethod)}
        >
          {METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <p className="mt-2 text-sm text-muted">{current.help}</p>
        {pending && (
          <div role="alert" className="animate-fade-in mt-2 flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface p-3 text-sm">
            <span className="flex-1">
              Cambiar a «{METHODS.find((m) => m.id === pending)!.label}» reinicia los valores base. ¿Continuar?
            </span>
            <button type="button" onClick={() => switchTo(pending)} className="rounded-md bg-brand px-3 py-1.5 font-bold text-white hover:bg-brand-hover">
              Cambiar
            </button>
            <button type="button" onClick={() => setPending(null)} className="rounded-md border border-line px-3 py-1.5 hover:border-brand">
              Cancelar
            </button>
          </div>
        )}
      </div>

      {method === "pointBuy" && (
        <p className="text-sm" aria-live="polite">
          <span className={`font-bold ${remaining === 0 ? "text-success" : ""}`}>{remaining}</span> de {POINT_BUY_TOTAL} puntos por gastar
        </p>
      )}

      {method === "roll" && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={newRolls}
            disabled={loadingRolls}
            className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold transition-colors enabled:hover:border-brand disabled:opacity-60"
          >
            {loadingRolls ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Dices size={16} aria-hidden="true" />}
            {loadingRolls ? "Tirando…" : "Nuevas tiradas"}
          </button>
          {!rolls && !loadingRolls && <span className="text-sm text-muted">Pulsa para tirar los dados.</span>}
          {rollsError && <span role="alert" className="text-sm text-brand-soft">{rollsError}</span>}
        </div>
      )}

      {usesPool && pool.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Fichas para repartir">
          {pool.map((v, i) => {
            // la ficha está usada si hay más casillas con ese valor que fichas iguales anteriores
            const used = countOf(assigned, v) > countOf(pool.slice(0, i), v);
            return (
              <span
                key={i}
                {...(used ? {} : dragProps(v))}
                className={`flex h-10 w-10 select-none items-center justify-center rounded-md border font-heading text-lg font-bold ${
                  used ? "border-line text-muted opacity-40" : "cursor-grab border-brand bg-brand/10 active:cursor-grabbing"
                }`}
              >
                {v}
              </span>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-3 py-2 font-semibold">Característica</th>
              <th scope="col" className="px-3 py-2 text-center font-semibold">{current.column}</th>
              <th scope="col" className="px-3 py-2 text-center font-semibold">
                Trasfondo
                <span className="ml-1 normal-case tracking-normal" aria-live="polite">
                  · {bonusLeft} {bonusLeft === 1 ? "punto" : "puntos"}
                </span>
              </th>
              <th scope="col" className="px-3 py-2 text-center font-semibold">Total</th>
              <th scope="col" className="px-3 py-2 text-center font-semibold">Mod</th>
            </tr>
          </thead>
          <tbody>
            {ABILITIES.map((a, i) => {
              const value = valueOf(a);
              const bonus = backgroundBonus[a] ?? 0;
              const total = value === null ? null : value + bonus;
              const mod = total === null ? null : modOf(total);
              const over = exceedsLimit(value, bonus);
              const isBg = backgroundAbilities.includes(a);
              return (
                <tr key={a} className={i % 2 === 0 ? "bg-panel" : "bg-surface"}>
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <span className="block font-semibold">{NAMES[a]}</span>
                    <span className="block text-xs text-muted">{DESCRIPTIONS[a]}</span>
                  </th>
                  <td className="px-3 py-2 text-center" data-ability={usesPool ? a : undefined}>
                    {usesPool ? (
                      <div className="flex items-center justify-center gap-2">
                        <span
                          {...(value !== null ? dragProps(value) : {})}
                          className={`flex h-9 w-9 select-none items-center justify-center rounded-md border font-heading font-bold ${
                            over ? "cursor-grab border-brand-soft bg-brand/20" : value !== null ? "cursor-grab border-brand bg-brand/10" : "border-dashed border-line text-muted"
                          }`}
                        >
                          {value ?? "—"}
                        </span>
                        <select
                          aria-label={`Valor de ${NAMES[a]}`}
                          className="w-20 rounded-md border border-line bg-surface px-1 py-1.5 text-fg disabled:opacity-60"
                          value={value ?? ""}
                          disabled={pool.length === 0}
                          onChange={(e) => (e.target.value === "" ? clear(a) : place(a, Number(e.target.value)))}
                        >
                          <option value="">—</option>
                          {[...new Set(pool)].sort((x, y) => y - x).map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <button type="button" className={stepBtn} aria-label={`Reducir ${NAMES[a]}`} disabled={(value ?? min) <= min} onClick={() => step(a, -1)}>
                          <Minus size={14} aria-hidden="true" />
                        </button>
                        <span className="w-8 text-center font-heading text-base font-bold">{value ?? "—"}</span>
                        <button type="button" className={stepBtn} aria-label={`Aumentar ${NAMES[a]}`} disabled={!canIncrease(a)} onClick={() => step(a, 1)}>
                          <Plus size={14} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className={`px-3 py-2 ${isBg ? "" : "opacity-30"}`}>
                    <div className="flex items-center justify-center gap-2">
                      <button type="button" className={stepBtn} aria-label={`Reducir bonificación de ${NAMES[a]}`} disabled={!isBg || bonus <= 0} onClick={() => bonusStep(a, -1)}>
                        <Minus size={14} aria-hidden="true" />
                      </button>
                      <span className="w-6 text-center font-bold">{bonus > 0 ? `+${bonus}` : "—"}</span>
                      <button
                        type="button"
                        className={stepBtn}
                        aria-label={`Aumentar bonificación de ${NAMES[a]}`}
                        disabled={!isBg || bonus >= 2 || bonusLeft <= 0 || (total ?? 0) >= 20}
                        onClick={() => bonusStep(a, 1)}
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                  <td className={`px-3 py-2 text-center font-heading text-lg font-bold ${over ? "text-brand-soft" : ""}`}>
                    {total ?? "—"}
                    {over && <span role="alert" className="block text-xs font-normal">Máximo 20</span>}
                  </td>
                  <td className={`px-3 py-2 text-center font-bold ${mod === null ? "text-muted" : modColor(mod)}`}>
                    {mod === null ? "—" : fmtMod(mod)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!bonusValid && (
        <p className="text-xs text-muted">
          Reparte los 3 puntos del trasfondo: +2 y +1, o +1 en las tres características.
        </p>
      )}

      {drag && (
        <span
          aria-hidden="true"
          className="pointer-events-none fixed z-50 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-brand bg-panel font-heading text-lg font-bold shadow-lg"
          style={{ left: drag.x, top: drag.y }}
        >
          {drag.value}
        </span>
      )}
    </div>
  );
}
