import { Shield, TriangleAlert } from "lucide-react";
import { boxTitle, sheetBox, statButton } from "./statUi";
import type { SheetData, ShowStat } from "./types";

// Clase de armadura y velocidad; cada una abre su desglose
export default function CombatBox({ d, show }: { d: Pick<SheetData, "ac" | "armorWarning" | "speed">; show: ShowStat }) {
  return (
    <section aria-label="Clase de armadura y velocidad" className={`${sheetBox} flex flex-col p-3`}>
      <h2 className={`${boxTitle} mb-1`}>CA y velocidad</h2>
      <button
        type="button"
        aria-haspopup="dialog"
        data-print="text"
        onClick={show({ kind: "ac" })}
        className={`${statButton} flex flex-1 items-center justify-between gap-2 rounded-md border-b border-line px-1 py-1.5 text-left`}
      >
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-fg">
          Clase de armadura
          {d.armorWarning && <TriangleAlert size={13} className="shrink-0 text-brand-soft" role="img" aria-label={d.armorWarning} />}
        </span>
        <span className="relative flex h-12 w-11 shrink-0 items-center justify-center">
          <Shield size={46} strokeWidth={1.25} aria-hidden="true" className="absolute inset-0 m-auto text-line-strong" />
          <span className="relative font-heading text-lg font-extrabold text-white">{d.ac}</span>
        </span>
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        data-print="text"
        onClick={show({ kind: "speed" })}
        className={`${statButton} flex flex-1 items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left`}
      >
        <span className="text-xs font-bold uppercase text-fg">Velocidad <span className="font-normal normal-case text-muted">(pies)</span></span>
        <span className="flex h-10 w-11 shrink-0 items-center justify-center rounded-md border border-line-strong font-heading text-lg font-extrabold text-white">{d.speed}</span>
      </button>
    </section>
  );
}
