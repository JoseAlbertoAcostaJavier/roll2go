import type { Attack } from "@/lib/rules/dnd2024/derive";
import { fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { iconSrc } from "@/lib/utils/icons";
import { card, cardTitle } from "@/app/components/ui/formStyles";
import MaskIcon from "@/app/components/ui/MaskIcon";

// Pestaña Acciones (spec §5): de momento, la tabla de ataques; la tabla se desplaza dentro de su caja en móvil
export default function ActionsTab({ attacks }: { attacks: Attack[] }) {
  return (
    <section className={card}>
      <h3 className={cardTitle}>Ataques</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="py-2 pr-3 font-semibold">Ataque</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Alcance</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Golpe</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Daño</th>
              <th scope="col" className="py-2 font-semibold">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {attacks.map((a, i) => (
              <tr key={`${a.name}-${i}`}>
                <th scope="row" className="py-2 pr-3 font-semibold">
                  <span className="flex items-center gap-2">
                    <MaskIcon
                      src={iconSrc("weaponType", a.kind)}
                      size={18}
                      label={a.kind === "ranged" ? "A distancia" : "Cuerpo a cuerpo"}
                      className="text-muted"
                    />
                    <span>
                      {a.name}
                      {a.mastery && <span className="block text-xs font-normal text-brand-soft">Maestría: {a.mastery}</span>}
                    </span>
                  </span>
                </th>
                <td className="py-2 pr-3 whitespace-nowrap">{a.range}</td>
                <td className="py-2 pr-3 font-heading font-bold">{fmtMod(a.bonus)}</td>
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    {a.damage}
                    <MaskIcon src={iconSrc("damageType", a.damageTypeId)} size={16} className="text-muted" />
                    {a.damageType && <span className="text-xs text-muted">{a.damageType}</span>}
                  </span>
                </td>
                <td className="py-2 text-muted">{a.properties.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
