import type { FeatureUse } from "@/lib/rules/dnd2024/derive/featureUses";
import FeatureUsesControl from "./FeatureUsesControl";
import MobileCollapse from "./MobileCollapse";
import { sheetSideBox } from "./statUi";

// Recursos: los usos de los rasgos del personaje (Furia, Recuperación arcana…), a mano durante el combate
export default function ResourcesBox({ uses, characterId, isOwner, className = "" }: {
  uses: FeatureUse[]; characterId: string; isOwner: boolean; className?: string;
}) {
  return (
    <section className={`${sheetSideBox} ${className}`}>
      <MobileCollapse title="Recursos">
        {uses.length === 0 ? (
          <p className="text-sm text-muted">Sin recursos</p>
        ) : (
          <ul className="space-y-2">
            {uses.map((u) => (
              <li key={u.key}><FeatureUsesControl characterId={characterId} use={u} isOwner={isOwner} showName /></li>
            ))}
          </ul>
        )}
      </MobileCollapse>
    </section>
  );
}
