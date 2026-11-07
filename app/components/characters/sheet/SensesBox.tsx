import { PASSIVE_SKILLS } from "@/lib/rules/dnd2024/derive/abilities";
import { ABILITY_ABBR, distanceText, skillName } from "@/lib/rules/dnd2024/sheet/labels";
import MobileCollapse from "./MobileCollapse";
import { abbrChip, sheetSideBox, subLabel } from "./statUi";
import type { SheetData } from "./types";

// Sentidos: Percepción, Investigación y Perspicacia pasivas (10 + bonificador) y visión en la oscuridad si la hay
export default function SensesBox({ d, className = "" }: {
  d: Pick<SheetData, "skills" | "darkvision">; className?: string;
}) {
  const passives = PASSIVE_SKILLS.flatMap((id) => {
    const s = d.skills.find((x) => x.id === id);
    return s ? [{ id, ability: s.ability, value: 10 + s.total }] : [];
  });
  return (
    <section className={`${sheetSideBox} ${className}`}>
      <MobileCollapse title="Sentidos">
        <p className={subLabel}>Pasivos</p>
        <ul className="space-y-2 text-sm">
          {passives.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 font-semibold text-fg">{skillName(p.id)}</span>
              <span className={abbrChip}>{ABILITY_ABBR[p.ability]}</span>
              <span className="w-6 text-right font-heading font-bold text-white">{p.value}</span>
            </li>
          ))}
        </ul>
        <p className={`${subLabel} mt-3`}>Otros sentidos</p>
        <p className="flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-fg">Visión en la oscuridad</span>
          <span className="shrink-0 text-muted">{d.darkvision ? distanceText(d.darkvision) : "—"}</span>
        </p>
      </MobileCollapse>
    </section>
  );
}
