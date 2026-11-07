"use client";

import type { ReactNode } from "react";
import AbilityStrip from "./AbilityStrip";
import ProficienciesBox from "./ProficienciesBox";
import SavesBox from "./SavesBox";
import SensesBox from "./SensesBox";
import SkillsBox from "./SkillsBox";
import StatDialog from "./StatDialog";
import StatusBox from "./StatusBox";
import { useStatDialog } from "./useStatDialog";
import type { HitDicePool } from "@/lib/rules/dnd2024/sheet/rest";
import type { SheetData, StatusState } from "./types";

export type { SheetData } from "./types";

// Maqueta de la ficha: la franja superior y, debajo, las cajas de consulta y el panel de pestañas.
// - < 768 px: una columna: defensas, salvaciones, habilidades, sentidos, competencias (plegadas) y las pestañas.
// - 768–1279 px: defensas a todo el ancho; las cajas en dos columnas (izquierda | habilidades) y las pestañas debajo.
// - 1280–1535 px: las cajas apiladas en una barra lateral, para que el panel de pestañas tenga más anchura.
// - ≥ 1536 px: las cajas en dos columnas estrechas (izquierda | habilidades) y las pestañas a la derecha.
// Las filas de la derecha (`auto` y `1fr`) hacen que el panel de pestañas empiece justo debajo de las defensas.
export default function SheetLayout({ d, characterId, isOwner, version, pools, status, tabs, children }: {
  d: SheetData;
  characterId: string;
  isOwner: boolean;
  /** Cambia con cada escritura del personaje en el servidor (su `updatedAt`); remonta el editor de PG. */
  version: number;
  /** Dados de golpe por clase (línea bajo los PG). */
  pools: HitDicePool[];
  /** Inspiración heroica, estados y agotamiento (`statusOf`). */
  status: StatusState;
  /** Navegación de pestañas (`SheetTabs`). */
  tabs: ReactNode;
  /** Paneles de las pestañas, pintados por la página. */
  children: ReactNode;
}) {
  const { open, show, close, detail } = useStatDialog(d);

  return (
    <div className="space-y-3 md:space-y-6">
      <div className="animate-fade-up">
        <AbilityStrip d={d} characterId={characterId} isOwner={isOwner} version={version} pools={pools} show={show} status={status} />
      </div>

      <div
        className="grid animate-fade-up grid-cols-1 items-start gap-3 md:gap-6 xl:grid-cols-[20rem_minmax(0,1fr)] xl:grid-rows-[auto_1fr] 2xl:grid-cols-[36.5rem_minmax(0,1fr)]"
        style={{ animationDelay: "50ms" }}
      >
        <div className="flex min-w-0 flex-col gap-6 xl:col-[2] xl:row-[1]">
          <StatusBox characterId={characterId} isOwner={isOwner} defenses={d.defenses} status={status} show={show} />
        </div>

        {/* Cajas de consulta: la colocación por columnas solo actúa donde son una rejilla (de 768 a 1279 px y desde 1536) */}
        <div className="flex min-w-0 flex-col gap-3 md:grid md:grid-cols-2 md:gap-6 md:grid-rows-[auto_auto_1fr] md:items-start xl:col-[1] xl:row-[1/span_2] xl:flex 2xl:grid 2xl:grid-cols-[15rem_20rem]">
          <SavesBox saves={d.saves} show={show} className="md:col-[1] md:row-[1]" />
          <SkillsBox skills={d.skills} show={show} className="min-w-0 md:col-[2] md:row-[1/span_3]" />
          <SensesBox d={d} className="md:col-[1] md:row-[2]" />
          <ProficienciesBox d={d} className="md:col-[1] md:row-[3]" />
        </div>

        {/* Panel de pestañas */}
        <div className="min-w-0 xl:col-[2] xl:row-[2]">
          {tabs}
          {children}
        </div>
      </div>

      {open && <StatDialog {...detail(open.stat)} onClose={close} opener={open.opener} />}
    </div>
  );
}
