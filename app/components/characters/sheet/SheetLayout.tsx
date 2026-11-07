"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import type { FeatureUse } from "@/lib/rules/dnd2024/derive/featureUses";
import type { HitDicePool } from "@/lib/rules/dnd2024/sheet/rest";
import AbilityStrip from "./AbilityStrip";
import CombatBox from "./CombatBox";
import HpBox from "./HpBox";
import ProficienciesBox from "./ProficienciesBox";
import ResourcesBox from "./ResourcesBox";
import SensesBox from "./SensesBox";
import SheetHeader, { type SheetHeaderProps } from "./SheetHeader";
import SkillsBox from "./SkillsBox";
import StatDialog from "./StatDialog";
import StatusBox from "./StatusBox";
import { useStatDialog } from "./useStatDialog";
import type { SheetData, StatusState } from "./types";

export type { SheetData } from "./types";

// Maqueta de la ficha:
// - Primera fila: identidad y puntos de golpe. Segunda: características (con salvaciones) y CA y velocidad.
// - Debajo, desde 1280 px, tres columnas: habilidades y competencias | pestañas | recursos, defensas, estados y sentidos.
// - Por debajo de 1280 px: las dos columnas de cajas a los lados y las pestañas debajo; en móvil, una sola columna con las
//   cajas plegadas (`MobileCollapse`).
export default function SheetLayout({ d, header, headerKey, characterId, isOwner, version, pools, recoversOther, featureUses, status, tabs, children }: {
  d: SheetData;
  /** Datos de la tarjeta de identidad. */
  header: SheetHeaderProps;
  /** Con otro aviso (p. ej. tras borrar un nivel desde la propia ficha) la tarjeta se monta de nuevo para mostrarlo. */
  headerKey: string;
  /** Si un descanso corto recuperaría algo más ahora (espacios de pacto, usos): para el aviso del diálogo. */
  recoversOther: boolean;
  /** Usos de los rasgos, para la caja de recursos. */
  featureUses: FeatureUse[];
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
    <div className="space-y-3">
      <Link href={header.backHref} className="flex w-max items-center gap-1 text-sm text-muted hover:text-white print:hidden">
        <ChevronLeft size={16} aria-hidden="true" /> Volver
      </Link>

      <div className="grid animate-fade-up items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SheetHeader key={headerKey} {...header} initiative={d.initiative} proficiencyBonus={d.proficiencyBonus} inspiration={status.heroicInspiration} show={show} />
        <HpBox d={d} characterId={characterId} isOwner={isOwner} version={version} pools={pools} recoversOther={recoversOther} />
      </div>

      <div className="grid animate-fade-up items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_14rem]" style={{ animationDelay: "50ms" }}>
        <AbilityStrip d={d} show={show} />
        <CombatBox d={d} show={show} />
      </div>

      <div
        className="grid animate-fade-up grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-[17rem_minmax(0,1fr)_15rem]"
        style={{ animationDelay: "100ms" }}
      >
        <div className="flex min-w-0 flex-col gap-3">
          <SkillsBox skills={d.skills} show={show} />
          <ProficienciesBox d={d} />
        </div>

        {/* Pestañas: en el centro desde 1280 px; por debajo, a todo el ancho tras las dos columnas de cajas */}
        <div className="order-last min-w-0 md:col-span-2 xl:order-none xl:col-span-1">
          {tabs}
          {children}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <ResourcesBox uses={featureUses} characterId={characterId} isOwner={isOwner} />
          <StatusBox characterId={characterId} isOwner={isOwner} defenses={d.defenses} status={status} show={show} />
          <SensesBox d={d} />
        </div>
      </div>

      {open && <StatDialog {...detail(open.stat)} onClose={close} opener={open.opener} />}
    </div>
  );
}
