import { TriangleAlert } from "lucide-react";
import type { Derived } from "@/lib/rules/dnd2024/derive";
import {
  ABILITY_ABBR, ABILITY_NAMES, distanceText, metersText, proficiencyName, skillName, toolName,
} from "@/lib/rules/dnd2024/labels";
import { ABILITIES } from "@/lib/rules/types";
import { card, cardTitle } from "@/app/components/formStyles";
import HpEditor from "./HpEditor";

export const fmtMod = (m: number) => (m > 0 ? `+${m}` : m < 0 ? `−${-m}` : "+0");

// Marca de competencia: vacía, competencia o pericia (doble)
function ProficiencyDot({ level }: { level: 0 | 1 | 2 }) {
  const label = level === 2 ? "Pericia" : level === 1 ? "Competencia" : "Sin competencia";
  return (
    <span title={label} className="flex shrink-0 items-center gap-0.5">
      <span className={`h-2.5 w-2.5 rounded-full border ${level > 0 ? "border-brand bg-brand" : "border-muted"}`} />
      {level === 2 && <span className="h-2.5 w-2.5 rounded-full border border-brand bg-brand" />}
      <span className="sr-only">{label}</span>
    </span>
  );
}

function StatBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-3 text-center">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      {children}
    </div>
  );
}

const bigValue = "font-heading text-2xl font-extrabold";

type Props = { d: Derived; characterId: string; isOwner: boolean };

export default function InfoTab({ d, characterId, isOwner }: Props) {
  const skills = [...d.skills].sort((a, b) => skillName(a.id).localeCompare(skillName(b.id), "es"));
  const other = [
    { label: "Armaduras", value: d.armor.map(proficiencyName).join(", ") },
    { label: "Armas", value: d.weapons.map(proficiencyName).join(", ") },
    { label: "Herramientas", value: d.tools.map(toolName).join(", ") },
    { label: "Idiomas", value: d.languages.join(", ") },
    { label: "Sentidos", value: d.darkvision ? `Visión en la oscuridad ${distanceText(d.darkvision)}` : "" },
  ];

  return (
    <div className="space-y-6">
      {/* Características: modificador grande y puntuación debajo */}
      <section aria-labelledby="abilities-title" className="animate-fade-up">
        <h3 id="abilities-title" className="sr-only">Características</h3>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {ABILITIES.map((a) => (
            <li key={a} className="rounded-lg border border-line bg-panel px-2 py-3 text-center">
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{ABILITY_NAMES[a]}</p>
              <p className="font-heading text-3xl font-extrabold">{fmtMod(d.abilities[a].mod)}</p>
              <p className="mx-auto mt-1 w-10 rounded-full border border-line bg-surface text-sm font-bold">{d.abilities[a].score}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Valores: PG, iniciativa, velocidad, CA y competencia */}
      <section aria-label="Valores" className="grid animate-fade-up grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" style={{ animationDelay: "50ms" }}>
        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
          <StatBox label="Puntos de golpe">
            {isOwner ? (
              <HpEditor characterId={characterId} max={d.hp.max} current={d.hp.current} temp={d.hp.temp} />
            ) : (
              <p className={bigValue}>
                {Math.min(d.hp.current, d.hp.max)}
                <span className="text-base font-bold text-muted"> / {d.hp.max}</span>
                {d.hp.temp > 0 && <span className="ml-1 text-base text-success">+{d.hp.temp}</span>}
              </p>
            )}
          </StatBox>
        </div>
        <StatBox label="Iniciativa"><p className={bigValue}>{fmtMod(d.initiative)}</p></StatBox>
        <StatBox label="Velocidad">
          <p className={bigValue}>{d.speed} pies</p>
          <p className="text-xs text-muted">({metersText(d.speed)})</p>
        </StatBox>
        <StatBox label="Clase de armadura">
          <p className={bigValue}>{d.ac}</p>
          {d.armorWarning && (
            <p className="mt-1 flex items-center justify-center gap-1 text-xs text-brand-soft">
              <TriangleAlert size={12} aria-hidden="true" /> {d.armorWarning}
            </p>
          )}
        </StatBox>
        <StatBox label="Bonif. competencia"><p className={bigValue}>{fmtMod(d.proficiencyBonus)}</p></StatBox>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className={`${card} animate-fade-up`} style={{ animationDelay: "100ms" }}>
          <h3 className={cardTitle}>Tiradas de salvación</h3>
          <ul className="divide-y divide-line">
            {d.saves.map((s) => (
              <li key={s.ability} className="flex items-center gap-3 py-2">
                <ProficiencyDot level={s.proficient ? 1 : 0} />
                <span className="flex-1">{ABILITY_NAMES[s.ability]}</span>
                <span className="font-heading font-bold">{fmtMod(s.total)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${card} animate-fade-up`} style={{ animationDelay: "150ms" }}>
          <h3 className={cardTitle}>Habilidades</h3>
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {skills.map((s) => (
              <li key={s.id} className="flex items-center gap-3 border-b border-line py-1.5">
                <ProficiencyDot level={s.proficiency} />
                <span className="min-w-0 flex-1 truncate">
                  {skillName(s.id)} <span className="text-xs text-muted">({ABILITY_ABBR[s.ability]})</span>
                </span>
                <span className="font-heading font-bold">{fmtMod(s.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={`${card} animate-fade-up`} style={{ animationDelay: "200ms" }}>
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
              {d.attacks.map((a, i) => (
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

      <section className={`${card} animate-fade-up`} style={{ animationDelay: "250ms" }}>
        <h3 className={cardTitle}>Otras competencias</h3>
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          {other.map((o) => (
            <div key={o.label} className="contents">
              <dt className="font-semibold">{o.label}</dt>
              <dd className="text-muted">{o.value || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
