import { ABILITY_ABBR, ABILITY_NAMES, fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { ABILITIES } from "@/lib/rules/types";
import { ProficiencyDot, boxTitle, sheetBox, statButton } from "./statUi";
import type { SheetData, ShowStat } from "./types";

const cell = "flex h-11 w-full items-center justify-center rounded-md border font-heading text-lg font-bold";
const cellLabel = "mt-1 block text-[11px] font-semibold text-muted";

// Características: la abreviatura y la puntuación arriba; debajo, el modificador y la tirada de salvación (resaltada si es
// competente). Cada valor abre su desglose.
export default function AbilityStrip({ d, show }: { d: SheetData; show: ShowStat }) {
  return (
    <section aria-label="Características y salvaciones" className={`${sheetBox} p-3`}>
      <h2 className={`${boxTitle} mb-3`}>Características</h2>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-6 sm:divide-x sm:divide-line sm:gap-x-0">
        {ABILITIES.map((a) => {
          const save = d.saves.find((s) => s.ability === a);
          return (
            <li key={a} className="min-w-0 sm:px-2">
              <div className="mb-2 flex items-center justify-center gap-2">
                <span title={ABILITY_NAMES[a]} className="font-heading text-sm font-extrabold text-white">
                  <span aria-hidden="true">{ABILITY_ABBR[a]}</span>
                  <span className="sr-only">{ABILITY_NAMES[a]}</span>
                </span>
                <span className="rounded border border-line bg-surface px-1.5 text-xs font-bold text-fg">
                  <span className="sr-only">Puntuación: </span>{d.abilities[a].score}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-center">
                <div>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    data-print="text"
                    aria-label={`${ABILITY_NAMES[a]}: modificador ${fmtMod(d.abilities[a].mod)}`}
                    onClick={show({ kind: "ability", ability: a })}
                    className={`${statButton} ${cell} border-line bg-surface ${d.abilities[a].mod < 0 ? "text-brand-soft" : "text-white"}`}
                  >
                    {fmtMod(d.abilities[a].mod)}
                  </button>
                  <span aria-hidden="true" className={cellLabel}>Mod</span>
                </div>
                {save && (
                  <div>
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      data-print="text"
                      aria-label={`Salvación de ${ABILITY_NAMES[a]}${save.proficient ? ", competente" : ""}: ${fmtMod(save.total)}`}
                      onClick={show({ kind: "save", ability: a })}
                      className={`${statButton} ${cell} relative ${save.proficient ? "border-brand bg-brand/20 text-white" : "border-transparent bg-surface text-white"}`}
                    >
                      {fmtMod(save.total)}
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-panel"><ProficiencyDot level={save.proficient ? 1 : 0} /></span>
                    </button>
                    <span aria-hidden="true" className={cellLabel}>Salv.</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
