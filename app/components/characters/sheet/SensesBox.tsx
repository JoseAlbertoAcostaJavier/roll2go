import { PASSIVE_SKILLS } from "@/lib/rules/dnd2024/derive/abilities";
import { distanceText, skillName } from "@/lib/rules/dnd2024/sheet/labels";
import { sheetCard } from "@/app/components/ui/formStyles";
import MobileCollapse from "./MobileCollapse";
import type { SheetData } from "./types";

// Sentidos: Percepción, Investigación y Perspicacia pasivas (10 + bonificador) y visión en la oscuridad si la hay
export default function SensesBox({ d, className = "" }: {
  d: Pick<SheetData, "skills" | "darkvision">; className?: string;
}) {
  const passives = PASSIVE_SKILLS.flatMap((id) => {
    const s = d.skills.find((x) => x.id === id);
    return s ? [{ id, value: 10 + s.total }] : [];
  });
  return (
    <section className={`${sheetCard} ${className}`}>
      <MobileCollapse title="Sentidos">
        <ul className="divide-y divide-line text-sm">
          {passives.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <span className="w-8 shrink-0 text-center font-heading text-base font-bold">{p.value}</span>
              <span>{skillName(p.id)} pasiva</span>
            </li>
          ))}
          {d.darkvision ? <li className="py-2">Visión en la oscuridad {distanceText(d.darkvision)}</li> : null}
        </ul>
      </MobileCollapse>
    </section>
  );
}
