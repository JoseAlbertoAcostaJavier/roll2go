import { TriangleAlert } from "lucide-react";
import { fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { chip, chipLabel, chipValue, statButton } from "./statUi";
import type { SheetData, ShowStat } from "./types";

// Combate: iniciativa y CA, cada una con su desglose
export default function CombatBox({ d, show, className = "" }: {
  d: Pick<SheetData, "ac" | "armorWarning" | "initiative">; show: ShowStat; className?: string;
}) {
  return (
    <section aria-label="Valores de combate" className={`grid grid-cols-2 gap-3 ${className}`}>
      <button
        type="button"
        aria-haspopup="dialog"
        data-print="text"
        onClick={show({ kind: "initiative" })}
        className={`${chip} ${statButton}`}
      >
        <span className={chipLabel}>Iniciativa</span>
        <span className={chipValue}>{fmtMod(d.initiative)}</span>
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        data-print="text"
        onClick={show({ kind: "ac" })}
        className={`${chip} ${statButton}`}
      >
        <span className={chipLabel}>
          CA
          {d.armorWarning && (
            <TriangleAlert size={12} className="text-brand-soft" role="img" aria-label={d.armorWarning} />
          )}
        </span>
        <span className={chipValue}>{d.ac}</span>
      </button>
    </section>
  );
}
