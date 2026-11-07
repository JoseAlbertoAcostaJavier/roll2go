"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FeatureUse } from "@/lib/rules/dnd2024/derive/featureUses";
import FeatureUsesControl from "./FeatureUsesControl";
import MobileCollapse from "./MobileCollapse";
import { sheetSideBox } from "./statUi";

// Los que se ven sin desplegar
const VISIBLE = 3;

// Recursos: los usos de los rasgos del personaje (Furia, Recuperación arcana…), con «− disponibles/máximo +»
export default function ResourcesBox({ uses, characterId, isOwner, className = "" }: {
  uses: FeatureUse[]; characterId: string; isOwner: boolean; className?: string;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? uses : uses.slice(0, VISIBLE);
  const more = uses.length - VISIBLE;
  return (
    <section className={`${sheetSideBox} ${className}`}>
      <MobileCollapse title="Recursos">
        {uses.length === 0 ? (
          <p className="text-sm text-muted">Sin recursos</p>
        ) : (
          <>
            <ul className="space-y-2">
              {shown.map((u) => (
                <li key={u.key}><FeatureUsesControl characterId={characterId} use={u} isOwner={isOwner} stepper /></li>
              ))}
            </ul>
            {more > 0 && (
              <button
                type="button"
                aria-expanded={all}
                onClick={() => setAll((a) => !a)}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-surface py-1 text-xs font-semibold text-muted transition-colors hover:text-white print:hidden"
              >
                {all ? "Menos" : `+${more} más`}
                <ChevronDown size={14} aria-hidden="true" className={all ? "rotate-180" : ""} />
              </button>
            )}
          </>
        )}
      </MobileCollapse>
    </section>
  );
}
