import type { Attack } from "@/lib/rules/dnd2024/derive";
import { fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { card, cardTitle } from "@/app/components/ui/formStyles";

// Pestaña Acciones (spec §5): de momento, la tabla de ataques; la tabla se desplaza dentro de su caja en móvil
export default function ActionsTab({ attacks }: { attacks: Attack[] }) {
  return (
    <section className={card}>
      <h3 className={cardTitle}>Ataques</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="py-2 pr-3 font-semibold">Ataque</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Bonif.</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Daño</th>
              <th scope="col" className="py-2 font-semibold">Propiedades</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {attacks.map((a, i) => (
              <tr key={`${a.name}-${i}`}>
                <th scope="row" className="py-2 pr-3 font-semibold">{a.name}</th>
                <td className="py-2 pr-3 font-heading font-bold">{fmtMod(a.bonus)}</td>
                <td className="py-2 pr-3">{a.damage} <span className="text-muted">{a.damageType}</span></td>
                <td className="py-2">
                  <span className="flex flex-wrap gap-1">
                    {a.properties.map((p) => (
                      <span key={p} className="rounded bg-surface px-2 py-0.5 text-xs">{p}</span>
                    ))}
                    {a.mastery && (
                      <span className="rounded border border-brand px-2 py-0.5 text-xs text-brand-soft">Maestría: {a.mastery}</span>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
