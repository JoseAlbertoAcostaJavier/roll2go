import { ABILITY_ABBR, fmtMod, skillName } from "@/lib/rules/dnd2024/sheet/labels";
import MobileCollapse from "./MobileCollapse";
import { ProficiencyDot, abbrChip, sheetSideBox, statButton } from "./statUi";
import type { SheetData, ShowStat } from "./types";

// Habilidades en orden alfabético: nombre, característica, bonificador (resaltado con competencia) y marca de competencia;
// cada una abre su desglose
export default function SkillsBox({ skills, show, className = "" }: {
  skills: SheetData["skills"]; show: ShowStat; className?: string;
}) {
  const sorted = [...skills].sort((a, b) => skillName(a.id).localeCompare(skillName(b.id), "es"));
  return (
    <section className={`${sheetSideBox} ${className}`}>
      <MobileCollapse title="Habilidades">
        <ul className="space-y-0.5">
          {sorted.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                aria-haspopup="dialog"
                data-print="text"
                onClick={show({ kind: "skill", id: s.id, ability: s.ability })}
                className={`${statButton} flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm`}
              >
                <span className="min-w-0 flex-1 font-semibold leading-tight text-fg">{skillName(s.id)}</span>
                <span className={abbrChip}>{ABILITY_ABBR[s.ability]}</span>
                <span className={`flex h-7 w-9 shrink-0 items-center justify-center rounded-md border font-heading text-sm font-bold text-white ${s.proficiency > 0 ? "border-brand bg-brand/20" : "border-transparent bg-surface"}`}>
                  {fmtMod(s.total)}
                </span>
                <ProficiencyDot level={s.proficiency} />
              </button>
            </li>
          ))}
        </ul>
      </MobileCollapse>
    </section>
  );
}
