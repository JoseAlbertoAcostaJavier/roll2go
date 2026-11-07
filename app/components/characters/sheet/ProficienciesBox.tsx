import { proficiencyName, toolName } from "@/lib/rules/dnd2024/sheet/labels";
import MobileCollapse from "./MobileCollapse";
import { fieldBox, sheetSideBox, subLabel, tagChip } from "./statUi";
import type { SheetData } from "./types";

// Competencias e idiomas: armas, armaduras, herramientas e idiomas, cada uno como etiquetas dentro de su recuadro
export default function ProficienciesBox({ d, className = "" }: {
  d: Pick<SheetData, "armor" | "weapons" | "tools" | "languages">; className?: string;
}) {
  const rows = [
    { label: "Armas", values: d.weapons.map(proficiencyName) },
    { label: "Armaduras", values: d.armor.map(proficiencyName) },
    { label: "Herramientas", values: d.tools.map(toolName) },
    { label: "Idiomas", values: d.languages },
  ];
  return (
    <section className={`${sheetSideBox} ${className}`}>
      <MobileCollapse title="Competencias e idiomas">
        <dl className="space-y-3">
          {rows.map((o) => (
            <div key={o.label}>
              <dt className={subLabel}>{o.label}</dt>
              <dd className={fieldBox}>
                {o.values.length > 0
                  ? o.values.map((v) => <span key={v} className={tagChip}>{v}</span>)
                  : <span className="px-1 text-xs text-muted">—</span>}
              </dd>
            </div>
          ))}
        </dl>
      </MobileCollapse>
    </section>
  );
}
