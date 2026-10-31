import type { DefenseKind, DefenseRow } from "@/lib/rules/dnd2024/derive";
import { defenseTypeName } from "@/lib/rules/dnd2024/sheet/labels";
import { card, cardTitle } from "@/app/components/ui/formStyles";
import { statButton } from "./statUi";
import type { ShowStat } from "./types";

// Grupos de la tarjeta de defensas, en el orden en que llegan las filas
export const DEFENSE_GROUPS: { kind: DefenseKind; title: string }[] = [
  { kind: "resist", title: "Resistencias" },
  { kind: "immune", title: "Inmunidades" },
  { kind: "vulnerable", title: "Vulnerabilidades" },
  { kind: "conditionImmune", title: "Inmunidad a estados" },
];
export const defenseLabel = (r: DefenseRow) => (r.type === null ? "a elegir" : defenseTypeName(r.kind, r.type));

// Defensas: resistencias, inmunidades y vulnerabilidades, solo si las hay
export default function DefensesBox({ defenses, show, className = "" }: {
  defenses: DefenseRow[]; show: ShowStat; className?: string;
}) {
  if (defenses.length === 0) return null;
  return (
    <section className={`${card} ${className}`}>
      <h3 className={cardTitle}>Defensas</h3>
      <button
        type="button"
        aria-haspopup="dialog"
        data-print="text"
        onClick={show({ kind: "defenses" })}
        className={`${statButton} block w-full space-y-1 rounded px-1 py-1 text-left text-sm`}
      >
        {DEFENSE_GROUPS.map((g) => {
          const rows = defenses.filter((r) => r.kind === g.kind);
          if (rows.length === 0) return null;
          return (
            <span key={g.kind} className="block">
              <span className="font-semibold">{g.title}: </span>
              <span className="text-muted">{rows.map(defenseLabel).join(", ")}</span>
            </span>
          );
        })}
      </button>
    </section>
  );
}
