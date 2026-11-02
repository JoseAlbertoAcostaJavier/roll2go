import { ABILITY_ABBR, ABILITY_NAMES, fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import type { Ability } from "@/lib/rules/types";
import { card, cardTitle } from "@/app/components/ui/formStyles";
import { ProficiencyDot, statButton } from "./statUi";
import type { SheetData, ShowStat } from "./types";

// Orden de la rejilla de 2 columnas: FUE·INT, DES·SAB, CON·CAR
const ORDER: Ability[] = ["str", "int", "dex", "wis", "con", "cha"];

// Tiradas de salvación en rejilla 2×3: punto de competencia, abreviatura y bonificador; cada una abre su desglose
export default function SavesBox({ saves, show, className = "" }: {
  saves: SheetData["saves"]; show: ShowStat; className?: string;
}) {
  const sorted = ORDER.map((a) => saves.find((s) => s.ability === a)).filter((s) => s !== undefined);
  return (
    <section className={`${card} ${className}`}>
      <h3 className={cardTitle}>Tiradas de salvación</h3>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {sorted.map((s) => (
          <li key={s.ability} className="min-w-0">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={`Salvación de ${ABILITY_NAMES[s.ability]}`}
              data-print="text"
              onClick={show({ kind: "save", ability: s.ability })}
              className={`${statButton} flex w-full items-center gap-2 rounded border-b border-line px-1 py-2 text-left`}
            >
              <ProficiencyDot level={s.proficient ? 1 : 0} />
              <span className="flex-1 text-xs font-semibold tracking-wide">{ABILITY_ABBR[s.ability]}</span>
              <span className="font-heading font-bold">{fmtMod(s.total)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
