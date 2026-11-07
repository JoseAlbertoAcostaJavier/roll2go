import { Footprints, Star } from "lucide-react";
import { ABILITY_NAMES, fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { ABILITIES } from "@/lib/rules/types";
import type { HitDicePool } from "@/lib/rules/dnd2024/sheet/rest";
import CombatBox from "./CombatBox";
import HpEditor, { HpBar } from "./HpEditor";
import InspirationBox from "./InspirationBox";
import { statButton, tile, tileLabel, tileValue } from "./statUi";
import type { SheetData, ShowStat, StatusState } from "./types";

const boxLabel = "block hyphens-none break-words text-[11px] font-bold uppercase leading-tight tracking-wide text-muted";

// Franja superior: las 6 características y una fila con los PG y los valores de combate.
// - < 768 px: primero los PG y los valores de combate (lo que más se consulta en la mesa) y después las características.
// - ≥ 768 px: las características en una fila; debajo, los PG a todo el ancho y los cinco valores en otra.
// - ≥ 1280 px: los PG y los cinco valores en una sola fila.
export default function AbilityStrip({ d, characterId, isOwner, version, pools, show, status }: {
  d: SheetData; characterId: string; isOwner: boolean; version: number; pools: HitDicePool[]; show: ShowStat;
  status: StatusState;
}) {
  return (
    <section aria-label="Características y puntos de golpe" className="flex flex-col gap-2.5">
      {/* Características: modificador grande y puntuación debajo; cada una abre su desglose */}
      <div>
        <h3 className="sr-only">Características</h3>
        <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {ABILITIES.map((a) => {
            const mod = d.abilities[a].mod;
            return (
              <li key={a}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  data-print="text"
                  onClick={show({ kind: "ability", ability: a })}
                  className={`${statButton} ${tile} flex h-24 w-full flex-col items-center justify-between px-1 py-2 text-center md:h-28 md:py-2.5`}
                >
                  <span className={`${boxLabel} w-full`}>{ABILITY_NAMES[a]}</span>
                  <span className={`font-heading text-3xl font-extrabold leading-none ${mod < 0 ? "text-brand-soft" : "text-white"}`}>{fmtMod(mod)}</span>
                  <span className="rounded-md border border-line bg-surface px-2 text-xs font-bold text-muted">{d.abilities[a].score}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="order-first grid grid-cols-6 gap-2.5 md:order-none md:grid-cols-5 xl:grid-cols-[minmax(0,2.6fr)_repeat(5,minmax(0,1fr))] print:order-none">
        {/* Puntos de golpe */}
        <div className={`${tile} col-span-6 p-3 md:col-span-5 xl:col-span-1`}>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
            <p className={boxLabel}>Puntos de golpe</p>
            {pools.length > 0 && (
              <p className="text-xs text-muted">Dados de golpe: {pools.map((p) => `${p.total - p.used}d${p.die}`).join(" · ")}</p>
            )}
          </div>
          {isOwner ? (
            // El editor guarda su estado y adopta los PG nuevos cuando cambia `version` (descanso, borrar un nivel) sin
            // remontarse: así un cambio de PG pendiente no se pierde cuando otra caja de la franja refresca la página.
            // Hace falta `version` y no solo los PG: tras un descanso los PG vuelven al valor de la carga
            <HpEditor version={version} characterId={characterId} max={d.hp.max} current={d.hp.current} temp={d.hp.temp} />
          ) : (
            <>
              <p className="font-heading text-3xl font-extrabold text-white">
                {Math.min(d.hp.current, d.hp.max)}
                <span className="text-xl font-bold text-muted"> / {d.hp.max}</span>
                {d.hp.temp > 0 && <span className="ml-1 text-base text-success">+{d.hp.temp}</span>}
              </p>
              <HpBar current={Math.min(d.hp.current, d.hp.max)} max={d.hp.max} temp={d.hp.temp} />
            </>
          )}
        </div>

        <CombatBox d={d} show={show} />

        <button
          type="button"
          aria-haspopup="dialog"
          data-print="text"
          onClick={show({ kind: "speed" })}
          className={`${statButton} ${tile} col-span-2 flex min-h-24 flex-col items-center justify-center px-1 text-center md:col-span-1`}
        >
          <span className={tileValue}>{d.speed}<span className="text-xs font-bold text-muted"> pies</span></span>
          <span className={tileLabel}><Footprints size={13} aria-hidden="true" className="shrink-0" /> Velocidad</span>
        </button>

        <div className={`${tile} col-span-3 flex min-h-24 flex-col items-center justify-center px-1 text-center md:col-span-1`}>
          <span className={tileValue}>{fmtMod(d.proficiencyBonus)}</span>
          <span className={tileLabel}><Star size={13} aria-hidden="true" className="shrink-0" /> Competencia</span>
        </div>

        <InspirationBox characterId={characterId} initial={status.heroicInspiration} isOwner={isOwner} className="col-span-3 md:col-span-1" />
      </div>
    </section>
  );
}
