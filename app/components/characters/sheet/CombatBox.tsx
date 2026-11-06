import { TriangleAlert } from "lucide-react";
import { fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { statButton } from "./statUi";
import type { SheetData, ShowStat } from "./types";

// Escudo: contorno en el rojo de marca atenuado (capa exterior) y relleno oscuro (capa interior, 2 px más pequeña)
const SHIELD = "polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%)";

// Combate: iniciativa (caja) y CA (escudo), cada una con su desglose
export default function CombatBox({ d, show, className = "" }: {
  d: Pick<SheetData, "ac" | "armorWarning" | "initiative">; show: ShowStat; className?: string;
}) {
  return (
    <section aria-label="Valores de combate" className={`flex items-stretch justify-center gap-4 ${className}`}>
      <button
        type="button"
        aria-haspopup="dialog"
        data-print="text"
        onClick={show({ kind: "initiative" })}
        className={`${statButton} flex h-24 w-32 flex-col items-center justify-center rounded-lg border-2 border-brand/40 bg-panel text-center`}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Iniciativa</span>
        <span className="font-heading text-3xl font-extrabold leading-tight">{fmtMod(d.initiative)}</span>
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        data-print="text"
        onClick={show({ kind: "ac" })}
        className="group relative h-28 w-28 cursor-pointer bg-brand/50 outline-none transition-colors hover:bg-brand focus-visible:bg-brand"
        style={{ clipPath: SHIELD }}
      >
        <span
          className="absolute inset-[2px] group-focus-visible:inset-[5px] flex flex-col items-center justify-start bg-panel pt-4 text-center group-hover:bg-surface group-focus-visible:bg-surface forced-colors:group-focus-visible:border-4 forced-colors:group-focus-visible:border-[Highlight]"
          style={{ clipPath: SHIELD }}
        >
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            CA
            {d.armorWarning && (
              <TriangleAlert size={12} className="text-brand-soft" role="img" aria-label={d.armorWarning} />
            )}
          </span>
          <span className="font-heading text-3xl font-extrabold leading-tight">{d.ac}</span>
        </span>
      </button>
    </section>
  );
}
