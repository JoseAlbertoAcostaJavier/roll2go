import { Shield, TriangleAlert, Zap } from "lucide-react";
import { fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { statButton, tile, tileLabel, tileValue } from "./statUi";
import type { SheetData, ShowStat } from "./types";

// Combate: CA e iniciativa, dos celdas de la fila de la franja; cada una abre su desglose
export default function CombatBox({ d, show }: {
  d: Pick<SheetData, "ac" | "armorWarning" | "initiative">; show: ShowStat;
}) {
  const cell = `${statButton} ${tile} col-span-2 flex min-h-24 flex-col items-center justify-center px-1 text-center md:col-span-1`;
  return (
    <>
      <button type="button" aria-haspopup="dialog" data-print="text" onClick={show({ kind: "ac" })} className={cell}>
        <span className={tileValue}>{d.ac}</span>
        <span className={tileLabel}>
          <Shield size={13} aria-hidden="true" className="shrink-0 text-sky-400" /> CA
          {d.armorWarning && <TriangleAlert size={12} className="text-brand-soft" role="img" aria-label={d.armorWarning} />}
        </span>
      </button>
      <button type="button" aria-haspopup="dialog" data-print="text" onClick={show({ kind: "initiative" })} className={cell}>
        <span className={tileValue}>{fmtMod(d.initiative)}</span>
        <span className={tileLabel}><Zap size={13} aria-hidden="true" className="shrink-0" /> Iniciativa</span>
      </button>
    </>
  );
}
