import type { HitDicePool } from "@/lib/rules/dnd2024/sheet/rest";
import HitDiceField from "./HitDiceField";
import HpEditor, { HpBar } from "./HpEditor";
import RestButtons from "./RestButtons";
import { boxTitle, sheetBox } from "./statUi";
import type { SheetData } from "./types";

// Puntos de golpe: actuales, máximos y temporales; daño y curación; descansos (el dueño) y dados de golpe disponibles
export default function HpBox({ d, characterId, isOwner, version, pools, recoversOther }: {
  d: SheetData; characterId: string; isOwner: boolean; version: number; pools: HitDicePool[]; recoversOther: boolean;
}) {
  return (
    <section aria-label="Puntos de golpe" className={`${sheetBox} flex flex-col p-4`}>
      <h2 className={`${boxTitle} mb-3`}>Puntos de golpe</h2>
      {isOwner ? (
        // El editor guarda su estado y adopta los PG nuevos cuando cambia `version` (descanso, borrar un nivel) sin
        // remontarse: así un cambio de PG pendiente no se pierde cuando otra caja de la ficha refresca la página.
        // Hace falta `version` y no solo los PG: tras un descanso los PG vuelven al valor de la carga
        <HpEditor
          version={version}
          characterId={characterId}
          max={d.hp.max}
          current={d.hp.current}
          temp={d.hp.temp}
          rest={<RestButtons characterId={characterId} pools={pools} conMod={d.abilities.con.mod} recoversOther={recoversOther} current={d.hp.current} max={d.hp.max} />}
        />
      ) : (
        <div className="max-w-52">
          <p className="font-heading text-3xl font-extrabold text-white">
            {Math.min(d.hp.current, d.hp.max)}
            <span className="text-xl font-bold text-muted"> / {d.hp.max}</span>
            {d.hp.temp > 0 && <span className="ml-1 text-base text-sky-400">+{d.hp.temp}</span>}
          </p>
          <HpBar current={Math.min(d.hp.current, d.hp.max)} max={d.hp.max} temp={d.hp.temp} />
        </div>
      )}
      {pools.length > 0 && (
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 max-lg:mt-3 lg:mt-auto">
          <span className="text-sm text-muted">Dados de golpe</span>
          {pools.map((p) => <HitDiceField key={p.classKey} characterId={characterId} pool={p} isOwner={isOwner} />)}
        </div>
      )}
    </section>
  );
}
