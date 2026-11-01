import { proficiencyName, toolName } from "@/lib/rules/dnd2024/sheet/labels";
import { card, cardTitle } from "@/app/components/ui/formStyles";
import type { SheetData } from "./types";

// Competencias y entrenamiento: armaduras, armas, herramientas e idiomas
export default function ProficienciesBox({ d, className = "" }: {
  d: Pick<SheetData, "armor" | "weapons" | "tools" | "languages">; className?: string;
}) {
  const rows = [
    { label: "Armaduras", value: d.armor.map(proficiencyName).join(", ") },
    { label: "Armas", value: d.weapons.map(proficiencyName).join(", ") },
    { label: "Herramientas", value: d.tools.map(toolName).join(", ") },
    { label: "Idiomas", value: d.languages.join(", ") },
  ];
  return (
    <section className={`${card} ${className}`}>
      <h3 className={cardTitle}>Competencias y entrenamiento</h3>
      <dl className="space-y-2 text-sm">
        {rows.map((o) => (
          <div key={o.label}>
            <dt className="font-semibold">{o.label}</dt>
            <dd className="text-muted">{o.value || "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
