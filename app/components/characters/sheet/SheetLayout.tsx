"use client";

import type { ReactNode } from "react";
import AbilityStrip from "./AbilityStrip";
import CombatBox from "./CombatBox";
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

// Maqueta de la ficha (spec §4): la franja superior y, debajo, una rejilla con las cajas y el panel de pestañas.
// - ≥ 1280 px: tres columnas (salvaciones, sentidos y competencias | habilidades | combate, defensas y pestañas).
// - 768–1279 px: combate y defensas a todo el ancho, dos columnas (izquierda | habilidades) y las pestañas debajo.
// - < 768 px: una columna en el orden de §4.4; la columna izquierda se deshace (`contents`) para que las habilidades
//   queden entre las salvaciones y los sentidos (`order-*`). Cada caja se pinta una sola vez.
// En escritorio la columna izquierda y la central ocupan las dos filas; la segunda es flexible (`1fr`), así que la
// primera mide lo que combate y defensas, y el panel de pestañas empieza justo debajo de ellas.
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
    <div className="space-y-6">
      <div className="animate-fade-up">
        <AbilityStrip d={d} characterId={characterId} isOwner={isOwner} version={version} pools={pools} show={show} status={status} />
      </div>

      <div
        className="grid animate-fade-up grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-[minmax(0,15rem)_minmax(0,18rem)_minmax(0,1fr)] xl:grid-rows-[auto_1fr]"
        style={{ animationDelay: "50ms" }}
      >
        {/* Combate y defensas: arriba a todo el ancho; en escritorio, en la columna derecha */}
        <div className="order-1 flex min-w-0 flex-col gap-6 md:col-span-2 xl:col-[3] xl:row-[1]">
          <CombatBox d={d} show={show} />
          <StatusBox characterId={characterId} isOwner={isOwner} defenses={d.defenses} status={status} show={show} />
        </div>

        {/* Columna izquierda: salvaciones, sentidos y competencias */}
        <div className="contents md:order-2 md:flex md:min-w-0 md:flex-col md:gap-6 xl:col-[1] xl:row-[1/span_2]">
          <SavesBox saves={d.saves} show={show} className="order-2" />
          <SensesBox d={d} className="order-4" />
          <ProficienciesBox d={d} className="order-5" />
        </div>

        <SkillsBox
          skills={d.skills}
          show={show}
          className="order-3 min-w-0 xl:col-[2] xl:row-[1/span_2]"
        />

        {/* Panel de pestañas: a todo el ancho debajo; en escritorio, en la columna derecha bajo combate y defensas */}
        <div className="order-6 min-w-0 md:col-span-2 xl:col-[3] xl:row-[2]">
          {tabs}
          {children}
        </div>
      </div>

      {open && <StatDialog {...detail(open.stat)} onClose={close} opener={open.opener} />}
    </div>
  );
}
