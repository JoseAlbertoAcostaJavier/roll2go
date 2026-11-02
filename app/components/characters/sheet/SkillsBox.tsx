import { ABILITY_ABBR, fmtMod, skillName } from "@/lib/rules/dnd2024/sheet/labels";
import { card, cardTitle } from "@/app/components/ui/formStyles";
import { ProficiencyDot, statButton } from "./statUi";
import type { SheetData, ShowStat } from "./types";

// Habilidades en orden alfabético: una fila por habilidad con su marca de competencia, la abreviatura de la
// característica, el nombre y el bonificador; cada una abre su desglose
export default function SkillsBox({ skills, show, className = "" }: {
  skills: SheetData["skills"]; show: ShowStat; className?: string;
}) {
  const sorted = [...skills].sort((a, b) => skillName(a.id).localeCompare(skillName(b.id), "es"));
  return (
    <section className={`${card} ${className}`}>
      <h3 className={cardTitle}>Habilidades</h3>
      {/* Cabecera de columnas; los anchos coinciden con los de cada fila */}
      <div aria-hidden="true" className="flex items-center gap-3 border-b border-line px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        <span className="w-7 shrink-0">Comp</span>
        <span className="w-8 shrink-0">Mod</span>
        <span className="min-w-0 flex-1">Habilidad</span>
        <span>Bonif.</span>
      </div>
      <ul>
        {sorted.map((s) => (
          <li key={s.id} className="border-b border-line last:border-b-0">
            <button
              type="button"
              aria-haspopup="dialog"
              data-print="text"
              onClick={show({ kind: "skill", id: s.id, ability: s.ability })}
              className={`${statButton} flex w-full items-center gap-3 rounded px-1 py-1.5 text-left`}
            >
              <span className="flex w-7 shrink-0"><ProficiencyDot level={s.proficiency} /></span>
              <span className="w-8 shrink-0 text-xs text-muted">{ABILITY_ABBR[s.ability]}</span>
              <span className="min-w-0 flex-1 truncate">{skillName(s.id)}</span>
              <span className="font-heading font-bold">{fmtMod(s.total)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
