import { ABILITY_NAMES, fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { ABILITIES } from "@/lib/rules/types";
import HpEditor from "./HpEditor";
import { chip, chipLabel, chipValue, statButton } from "./statUi";
import type { SheetData, ShowStat } from "./types";

// Franja superior (spec §4.1): las 6 características, competencia, velocidad y PG. En móvil, las características en
// rejilla de 3 y debajo competencia, velocidad y PG; en escritorio, todo en una fila
export default function AbilityStrip({ d, characterId, isOwner, show }: {
  d: SheetData; characterId: string; isOwner: boolean; show: ShowStat;
}) {
  return (
    <section aria-label="Características y puntos de golpe" className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
      {/* Características: modificador grande y puntuación en una píldora; cada una abre su desglose */}
      <div>
        <h3 className="sr-only">Características</h3>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {ABILITIES.map((a) => (
            <li key={a}>
              <button
                type="button"
                aria-haspopup="dialog"
                data-print="text"
                onClick={show({ kind: "ability", ability: a })}
                className={`${statButton} w-full rounded-lg border border-line bg-panel px-2 py-2 text-center`}
              >
                <span className="block truncate text-xs font-semibold uppercase tracking-wide text-muted">{ABILITY_NAMES[a]}</span>
                <span className="block font-heading text-2xl font-extrabold leading-tight">{fmtMod(d.abilities[a].mod)}</span>
                <span className="mx-auto mt-0.5 block w-10 rounded-full border border-line bg-surface text-sm font-bold">{d.abilities[a].score}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Competencia y velocidad en fichas compactas; los PG, a todo el ancho en móvil */}
      <div className="grid grid-cols-2 content-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] xl:grid-cols-[6.5rem_6.5rem_auto]">
        <div className={chip}>
          <span className={chipLabel}>Competencia</span>
          <span className={chipValue}>{fmtMod(d.proficiencyBonus)}</span>
        </div>
        <button
          type="button"
          aria-haspopup="dialog"
          data-print="text"
          onClick={show({ kind: "speed" })}
          className={`${chip} ${statButton}`}
        >
          <span className={chipLabel}>Velocidad</span>
          <span className={chipValue}>{d.speed} pies</span>
        </button>
        <div className="col-span-2 rounded-md border border-line bg-surface px-3 py-3 text-center sm:col-span-1">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Puntos de golpe</p>
          {isOwner ? (
            // El editor guarda su estado: tras un descanso o al borrar un nivel se monta de nuevo con los PG nuevos
            <HpEditor
              key={`${d.hp.max}:${d.hp.current}:${d.hp.temp}`}
              characterId={characterId}
              max={d.hp.max}
              current={d.hp.current}
              temp={d.hp.temp}
            />
          ) : (
            <p className="font-heading text-2xl font-extrabold">
              {Math.min(d.hp.current, d.hp.max)}
              <span className="text-base font-bold text-muted"> / {d.hp.max}</span>
              {d.hp.temp > 0 && <span className="ml-1 text-base text-success">+{d.hp.temp}</span>}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
