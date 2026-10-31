import { ABILITY_NAMES, fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { card, cardTitle } from "@/app/components/ui/formStyles";
import { ProficiencyDot, statButton } from "./statUi";
import type { SheetData, ShowStat } from "./types";

// Tiradas de salvación, cada una con su desglose
export default function SavesBox({ saves, show, className = "" }: {
  saves: SheetData["saves"]; show: ShowStat; className?: string;
}) {
  return (
    <section className={`${card} ${className}`}>
      <h3 className={cardTitle}>Tiradas de salvación</h3>
      <ul className="divide-y divide-line">
        {saves.map((s) => (
          <li key={s.ability}>
            <button
              type="button"
              aria-haspopup="dialog"
              data-print="text"
              onClick={show({ kind: "save", ability: s.ability })}
              className={`${statButton} flex w-full items-center gap-3 rounded px-1 py-2 text-left`}
            >
              <ProficiencyDot level={s.proficient ? 1 : 0} />
              <span className="flex-1">{ABILITY_NAMES[s.ability]}</span>
              <span className="font-heading font-bold">{fmtMod(s.total)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
