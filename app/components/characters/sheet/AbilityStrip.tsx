import { ABILITY_NAMES, fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { ABILITIES } from "@/lib/rules/types";
import type { HitDicePool } from "@/lib/rules/dnd2024/sheet/rest";
import HpEditor from "./HpEditor";
import InspirationBox from "./InspirationBox";
import { statButton } from "./statUi";
import type { SheetData, ShowStat, StatusState } from "./types";

// Marco común de las cajas de la franja: el rojo de marca atenuado sobre el fondo oscuro
const box = "rounded-lg border-2 border-brand/40 bg-panel";
const boxLabel = "block truncate text-[11px] font-semibold uppercase tracking-wide text-muted";

// Franja superior (spec de la ficha visual §3.1): las 6 características, competencia, velocidad, inspiración heroica y PG.
// - ≥ 1280 px: todo en una fila.
// - 768–1279 px: características en una fila de 6; debajo, competencia, velocidad e inspiración y los PG.
// - < 768 px: características en rejilla de 3; debajo, competencia, velocidad e inspiración en una fila y los PG a todo el ancho.
export default function AbilityStrip({ d, characterId, isOwner, version, pools, show, status }: {
  d: SheetData; characterId: string; isOwner: boolean; version: number; pools: HitDicePool[]; show: ShowStat;
  status: StatusState;
}) {
  return (
    <section
      aria-label="Características y puntos de golpe"
      className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:items-stretch"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,6fr)_minmax(0,3fr)]">
        {/* Características: modificador grande y puntuación en una píldora sobre el borde inferior; cada una abre su desglose */}
        <div>
          <h3 className="sr-only">Características</h3>
          <ul className="grid grid-cols-3 gap-x-2 gap-y-5 pb-3 sm:grid-cols-6">
            {ABILITIES.map((a) => (
              <li key={a}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  data-print="text"
                  onClick={show({ kind: "ability", ability: a })}
                  className={`${statButton} ${box} relative flex h-24 w-full flex-col items-center justify-start px-1 pt-2 text-center`}
                >
                  <span className={`${boxLabel} w-full`}>{ABILITY_NAMES[a]}</span>
                  <span className="mt-1 block font-heading text-3xl font-extrabold leading-none">{fmtMod(d.abilities[a].mod)}</span>
                  <span className="absolute -bottom-3 left-1/2 w-10 -translate-x-1/2 rounded-full border-2 border-brand/60 bg-surface text-sm font-bold">
                    {d.abilities[a].score}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Competencia, velocidad e inspiración: del mismo alto que las características */}
        <div className="grid grid-cols-3 gap-2 pb-3 sm:pt-0">
          <div className={`${box} flex h-24 flex-col items-center justify-center px-1 text-center`}>
            <span className="font-heading text-2xl font-extrabold leading-none">{fmtMod(d.proficiencyBonus)}</span>
            <span className={`${boxLabel} mt-1 w-full`}>Competencia</span>
          </div>
          <button
            type="button"
            aria-haspopup="dialog"
            data-print="text"
            onClick={show({ kind: "speed" })}
            className={`${statButton} ${box} flex h-24 flex-col items-center justify-center px-1 text-center`}
          >
            <span className="font-heading text-2xl font-extrabold leading-none">{d.speed}<span className="text-xs font-bold text-muted"> pies</span></span>
            <span className={`${boxLabel} mt-1 w-full`}>Velocidad</span>
          </button>
          <InspirationBox
            key={String(status.heroicInspiration)}
            characterId={characterId}
            initial={status.heroicInspiration}
            isOwner={isOwner}
            className="h-24 !py-1"
          />
        </div>
      </div>

      {/* Puntos de golpe, con los dados de golpe debajo */}
      <div className={`${box} px-3 py-3 text-center`}>
        <p className={`${boxLabel} mb-2`}>Puntos de golpe</p>
        {isOwner ? (
          // El editor guarda su estado: se monta de nuevo cuando el personaje cambia en el servidor (descanso, borrar un nivel).
          // La clave lleva `version` y no solo los PG: editar PG no refresca la página y, tras un descanso, los PG vuelven
          // al valor de la carga, que la clave por valores no distinguiría
          <HpEditor
            key={`${version}:${d.hp.max}:${d.hp.current}:${d.hp.temp}`}
            characterId={characterId}
            max={d.hp.max}
            current={d.hp.current}
            temp={d.hp.temp}
          />
        ) : (
          <p className="font-heading text-3xl font-extrabold">
            {Math.min(d.hp.current, d.hp.max)}
            <span className="text-xl font-bold text-muted"> / {d.hp.max}</span>
            {d.hp.temp > 0 && <span className="ml-1 text-base text-success">+{d.hp.temp}</span>}
          </p>
        )}
        {pools.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Dados de golpe: {pools.map((p) => `${p.total - p.used}d${p.die}`).join(" · ")}
          </p>
        )}
      </div>
    </section>
  );
}
