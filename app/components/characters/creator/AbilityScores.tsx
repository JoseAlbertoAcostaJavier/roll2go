"use client";

import { useEffect, useRef, useState } from "react";
import { Dices, LoaderCircle, Minus, Plus } from "lucide-react";
import { ABILITIES, type Ability } from "@/lib/rules/types";
import type { AbilityMethod } from "@/lib/rules/dnd2024/sheet/sheet";
import { POINT_BUY_TOTAL, STANDARD_ARRAY, checkBackgroundBonus, pointBuyCost } from "@/lib/rules/dnd2024/creation/abilities";
import { assignValue, exceedsLimit, maxBase, poolSlots, totalsWithinLimit } from "@/lib/rules/dnd2024/creation/assign";
import { fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { labelClass } from "../../ui/formStyles";

type Base = Record<Ability, number | null>;
type Bonus = Partial<Record<Ability, number>>;
/** `valid` es false si alguna característica supera 20 en total (base + trasfondo). */
type Next = { method: AbilityMethod; base: Base; rolls: number[] | null; backgroundBonus: Bonus; valid: boolean };

const NAMES: Record<Ability, string> = {
  str: "Fuerza", dex: "Destreza", con: "Constitución", int: "Inteligencia", wis: "Sabiduría", cha: "Carisma",
};
const DESCRIPTIONS: Record<Ability, string> = {
  str: "Potencia física y deportes",
  dex: "Agilidad y reflejos",
  con: "Resistencia y salud",
  int: "Razonamiento y memoria",
  wis: "Perspicacia e intuición",
  cha: "Fuerza de personalidad",
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
const modColor = (m: number) => (m > 0 ? "bg-success/10 text-success" : m < 0 ? "bg-brand/10 text-brand-soft" : "border border-line bg-surface text-muted");

const stepBtn =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface transition-colors enabled:hover:border-brand enabled:hover:text-brand-soft disabled:opacity-30";
// Columnas de las filas de características (en móvil, cada fila se reordena en dos líneas)
const rowColumns = "sm:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_4rem_3rem]";

const countOf = (list: (number | null)[], v: number) => list.filter((x) => x === v).length;

export default function AbilityScores({
  method, base, rolls, rollDice = null, backgroundAbilities, backgroundBonus, onChange, onRequestRolls,
}: {
  method: AbilityMethod;
  /** Con `pointBuy`, un valor vacío se muestra como 8: el padre debería partir del valor por defecto del método. */
  base: Base;
  rolls: number[] | null;
  /** Los 4 dados de cada tirada (mismo orden que `rolls`), para mostrarlos al pasar el ratón o enfocar. */
  rollDice?: number[][] | null;
  backgroundAbilities: Ability[];
  backgroundBonus: Bonus;
  /** Cada cambio informa también de `valid` (ningún total > 20). */
  onChange: (next: Next) => void;
  onRequestRolls: () => Promise<void>;
}) {
  const [pending, setPending] = useState<AbilityMethod | null>(null); // método pedido, a la espera de confirmar
  const [loadingRolls, setLoadingRolls] = useState(false);
  const [rollsError, setRollsError] = useState("");

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
  // Una opción por tirada (las repetidas por separado), con la característica que ya la tiene
  const { slots, selected } = poolSlots(pool, assigned);

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
    <div className="space-y-5">
      <fieldset className="min-w-0">
        <legend className={labelClass}>Método</legend>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {METHODS.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-center text-sm font-semibold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-soft ${
                m.id === method ? "border-brand bg-brand/10 text-white" : "border-line bg-surface/40 text-muted hover:border-line-strong hover:text-white"
              }`}
            >
              <input type="radio" name="ability-method" className="sr-only" checked={m.id === method} onChange={() => requestMethod(m.id)} />
              {m.label}
            </label>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">{current.help}</p>
        {pending && (
          <div role="alert" className="animate-fade-in mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-brand-soft/30 bg-brand-soft/5 p-4 text-sm font-medium">
            <span className="flex-1 text-white">
              Cambiar a <strong className="text-brand-soft">«{METHODS.find((m) => m.id === pending)!.label}»</strong> reinicia los valores base. ¿Continuar?
            </span>
            <button type="button" onClick={() => switchTo(pending)} className="rounded-md bg-brand px-4 py-2 font-bold text-white hover:bg-brand-hover">
              Sí, cambiar
            </button>
            <button type="button" onClick={() => setPending(null)} className="rounded-md border border-line bg-panel px-4 py-2 hover:border-fg hover:text-white">
              Cancelar
            </button>
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        {method === "pointBuy" && (
          <p className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-sm" aria-live="polite">
            <span className="text-muted">Puntos por gastar:</span>
            <span className={`font-heading text-lg font-bold ${remaining === 0 ? "text-success" : "text-white"}`}>{remaining}</span>
            <span className="text-muted">/ {POINT_BUY_TOTAL}</span>
          </p>
        )}
        <p className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-sm" aria-live="polite">
          <span className="text-muted">Trasfondo:</span>
          <span className={`font-heading text-lg font-bold ${bonusLeft === 0 ? "text-success" : "text-white"}`}>{bonusLeft}</span>
          <span className="text-muted">/ {BONUS_POINTS}</span>
        </p>
        {method === "roll" && (
          <>
            <button
              type="button"
              onClick={newRolls}
              disabled={loadingRolls}
              className="flex items-center gap-2 rounded-md border border-line-strong bg-surface px-4 py-2 text-sm font-bold text-fg transition-colors enabled:hover:border-fg disabled:opacity-60"
            >
              {loadingRolls ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Dices size={16} aria-hidden="true" />}
              {loadingRolls ? "Tirando…" : rolls ? "Nuevas tiradas" : "Tirar dados"}
            </button>
            {rollsError && <span role="alert" className="text-sm font-medium text-danger">{rollsError}</span>}
          </>
        )}
      </div>

      {usesPool && pool.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={method === "roll" ? "Tiradas para repartir" : "Valores para repartir"}>
          {pool.map((v, i) => {
            // la ficha está usada si hay más casillas con ese valor que fichas iguales anteriores
            const used = countOf(assigned, v) > countOf(pool.slice(0, i), v);
            const dice = method === "roll" ? rollDice?.[i] : undefined;
            return <PoolChip key={i} value={v} used={used} dice={dice} />;
          })}
        </div>
      )}

      <div className="rounded-xl border border-line">
        <div aria-hidden="true" className={`hidden items-center gap-x-3 border-b border-line bg-surface/50 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-muted sm:grid ${rowColumns}`}>
          <span className="text-left">Característica</span>
          <span>{current.column}</span>
          <span>Trasfondo</span>
          <span>Total</span>
          <span>Mod</span>
        </div>
        <ul className="divide-y divide-line">
          {ABILITIES.map((a, i) => {
            const value = valueOf(a);
            const bonus = backgroundBonus[a] ?? 0;
            const total = value === null ? null : value + bonus;
            const mod = total === null ? null : modOf(total);
            const over = exceedsLimit(value, bonus);
            const isBg = backgroundAbilities.includes(a);
            return (
              <li key={a} className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-3 px-4 py-3 transition-colors hover:bg-surface/30 ${rowColumns}`}>
                <div className="min-w-0">
                  <span className="block font-extrabold text-white">{NAMES[a]}</span>
                  <span className="block text-xs text-muted">{DESCRIPTIONS[a]}</span>
                </div>
                {/* En móvil, los dos controles van en su propia línea, bajo el total */}
                <div className="order-last col-span-3 grid grid-cols-2 gap-3 sm:order-none sm:col-span-2 sm:grid-cols-subgrid">
                  <div>
                    <span className="mb-1 block text-center text-[11px] font-bold uppercase tracking-wide text-muted sm:hidden">{current.column}</span>
                    {usesPool ? (
                      <select
                        aria-label={`Valor de ${NAMES[a]}`}
                        className="w-full rounded-md border border-line-strong bg-surface px-2 py-2 text-center font-bold text-fg focus:border-brand focus:outline-none disabled:opacity-60"
                        value={selected[i] ?? ""}
                        disabled={pool.length === 0}
                        onChange={(e) => (e.target.value === "" ? clear(a) : place(a, pool[Number(e.target.value)]))}
                      >
                        <option value="">—</option>
                        {slots.map((s) => (
                          <option key={s.index} value={s.index}>
                            {s.owner !== null && s.owner !== i ? `${s.value} · ${NAMES[ABILITIES[s.owner]]}` : s.value}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5">
                        <button type="button" className={stepBtn} aria-label={`Reducir ${NAMES[a]}`} disabled={(value ?? min) <= min} onClick={() => step(a, -1)}>
                          <Minus size={14} aria-hidden="true" />
                        </button>
                        <span className="w-8 text-center font-heading text-lg font-bold">{value ?? "—"}</span>
                        <button type="button" className={stepBtn} aria-label={`Aumentar ${NAMES[a]}`} disabled={!canIncrease(a)} onClick={() => step(a, 1)}>
                          <Plus size={14} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={isBg ? "" : "opacity-40"}>
                    <span className="mb-1 block text-center text-[11px] font-bold uppercase tracking-wide text-muted sm:hidden">Trasfondo</span>
                    <div className="flex items-center justify-center gap-1.5">
                      <button type="button" className={stepBtn} aria-label={`Reducir bonificación de ${NAMES[a]}`} disabled={!isBg || bonus <= 0} onClick={() => bonusStep(a, -1)}>
                        <Minus size={14} aria-hidden="true" />
                      </button>
                      <span className={`w-8 text-center text-lg font-bold ${bonus > 0 ? "text-success" : "text-muted"}`}>{bonus > 0 ? `+${bonus}` : "—"}</span>
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
                  </div>
                </div>
                <div className={`text-center font-heading text-xl font-bold ${over ? "text-danger" : "text-white"}`}>
                  <span className="sr-only">Total: </span>
                  {total ?? "—"}
                  {over && <span role="alert" className="block text-[10px] font-bold uppercase tracking-wide">Máximo 20</span>}
                </div>
                <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full font-heading font-bold ${mod === null ? "border border-line text-muted" : modColor(mod)}`}>
                  <span className="sr-only">Modificador: </span>
                  {mod === null ? "—" : fmtMod(mod)}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {!bonusValid && backgroundAbilities.length > 0 && (
        <p className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm font-medium text-yellow-500">
          Reparte los 3 puntos del trasfondo: +2 y +1, o +1 en las tres características.
        </p>
      )}
    </div>
  );
}

// Índice del dado descartado (el menor; si hay empate, el último de ellos)
const droppedIndex = (dice: number[]) => dice.lastIndexOf(Math.min(...dice));
const dieColor = (n: number) => (n === 1 ? "border-brand-soft text-brand-soft" : n === 6 ? "border-success text-success" : "border-line");

/* Ficha de una tirada o valor por repartir. Con los dados de la tirada, al pasar el ratón o enfocarla se muestran: el
   descartado atenuado, los 1 en rojo y los 6 en verde. */
function PoolChip({ value, used, dice }: { value: number; used: boolean; dice?: number[] }) {
  const chip = `flex h-11 w-11 select-none items-center justify-center rounded-lg border font-heading text-xl font-extrabold transition-all ${
    used ? "scale-95 border-line bg-surface text-muted opacity-40" : "border-brand-soft bg-brand-soft/20 text-brand-soft"
  }`;
  if (!dice?.length) return <span className={chip}>{value}</span>;
  const dropped = droppedIndex(dice);
  const label = `${value}: dados ${dice.join(", ")}; se descarta el ${dice[dropped]}`;
  return (
    <span className="group relative">
      <span tabIndex={0} aria-label={label} className={`${chip} cursor-help focus-visible:outline-2 focus-visible:outline-brand`}>
        {value}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-20 mb-2 flex -translate-x-1/2 gap-1 rounded-md border border-line bg-panel p-2 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {dice.map((n, i) => (
          <span
            key={i}
            className={`flex h-7 w-7 items-center justify-center rounded border font-heading text-sm font-bold ${dieColor(n)} ${
              i === dropped ? "opacity-35 line-through" : ""
            }`}
          >
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}
