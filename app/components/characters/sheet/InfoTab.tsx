"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { Breakdown, Derived } from "@/lib/rules/dnd2024/derive";
import { PASSIVE_SKILLS } from "@/lib/rules/dnd2024/derive/abilities";
import {
  ABILITY_ABBR, ABILITY_NAMES, distanceText, fmtMod, proficiencyName, skillName, toolName,
} from "@/lib/rules/dnd2024/sheet/labels";
import {
  ABILITY_TEXTS, AC_TEXT, INITIATIVE_TEXT, saveText, SKILL_TEXTS, SPEED_TEXT, type BreakdownUnit,
} from "@/lib/rules/dnd2024/sheet/statTexts";
import { ABILITIES, type Ability } from "@/lib/rules/types";
import { card, cardTitle } from "@/app/components/formStyles";
import HpEditor from "./HpEditor";
import StatDialog from "./StatDialog";

// «CAR» → «Car», para el título de una habilidad: «Engaño (Car)»
const abbr = (a: Ability) => ABILITY_ABBR[a][0] + ABILITY_ABBR[a].slice(1).toLowerCase();

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

// Valores que abren su detalle: el área entera se puede pulsar, sin parecer un botón de acción. Al imprimir se ven
// como texto (`data-print`, ver globals.css)
const statButton =
  "cursor-pointer transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand";
const chip = "flex h-14 flex-col items-center justify-center rounded-md border border-line bg-surface px-2 text-center";
const chipLabel = "flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted";
const chipValue = "font-heading text-xl font-extrabold leading-tight";

// Valor abierto en el diálogo (uno a la vez) y el botón que lo abrió
type Stat =
  | { kind: "ability" | "save"; ability: Ability }
  | { kind: "skill"; id: string; ability: Ability }
  | { kind: "ac" | "initiative" | "speed" };
type Open = { stat: Stat; opener: HTMLElement };
type Detail = { title: string; subject: string; description: string; breakdown: Breakdown; unit?: BreakdownUnit };

/** Los valores derivados que muestra la pestaña (solo esos viajan al navegador). */
export type InfoData = Pick<Derived,
  | "abilities" | "proficiencyBonus" | "hp" | "ac" | "armorWarning" | "initiative" | "speed" | "darkvision" | "saves"
  | "skills" | "armor" | "weapons" | "tools" | "languages" | "attacks" | "breakdowns">;

type Props = { d: InfoData; characterId: string; isOwner: boolean };

export default function InfoTab({ d, characterId, isOwner }: Props) {
  const [open, setOpen] = useState<Open | null>(null);
  const skills = [...d.skills].sort((a, b) => skillName(a.id).localeCompare(skillName(b.id), "es"));
  const other = [
    { label: "Armaduras", value: d.armor.map(proficiencyName).join(", ") },
    { label: "Armas", value: d.weapons.map(proficiencyName).join(", ") },
    { label: "Herramientas", value: d.tools.map(toolName).join(", ") },
    { label: "Idiomas", value: d.languages.join(", ") },
    { label: "Sentidos", value: d.darkvision ? `Visión en la oscuridad ${distanceText(d.darkvision)}` : "" },
  ];

  // El botón se captura al pulsar (Safari no lo enfoca)
  const show = (stat: Stat) => (e: React.MouseEvent<HTMLElement>) => setOpen({ stat, opener: e.currentTarget });

  // Título, descripción y desglose del valor abierto
  function detail(stat: Stat): Detail {
    const b = d.breakdowns;
    switch (stat.kind) {
      case "ability": {
        const name = ABILITY_NAMES[stat.ability];
        return {
          title: name, subject: `tu puntuación de ${name}`, description: ABILITY_TEXTS[stat.ability],
          breakdown: b.abilities[stat.ability], unit: "plain",
        };
      }
      case "save": {
        const name = ABILITY_NAMES[stat.ability];
        return {
          title: `Salvación de ${name}`, subject: `la tirada de salvación de ${name}`, description: saveText(stat.ability),
          breakdown: b.saves[stat.ability],
        };
      }
      case "skill": {
        const title = `${skillName(stat.id)} (${abbr(stat.ability)})`;
        return { title, subject: title, description: SKILL_TEXTS[stat.id], breakdown: b.skills[stat.id] };
      }
      case "ac":
        return { title: "Clase de armadura", subject: "la Clase de armadura", description: AC_TEXT, breakdown: b.ac, unit: "plain" };
      case "initiative":
        return { title: "Iniciativa", subject: "la iniciativa", description: INITIATIVE_TEXT, breakdown: b.initiative };
      case "speed":
        return { title: "Velocidad", subject: "la velocidad", description: SPEED_TEXT, breakdown: b.speed, unit: "feet" };
    }
  }

  return (
    <div className="space-y-6">
      {/* Características: modificador grande y puntuación en una píldora; cada una abre su desglose */}
      <section aria-labelledby="abilities-title" className="animate-fade-up">
        <h3 id="abilities-title" className="sr-only">Características</h3>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {ABILITIES.map((a) => (
            <li key={a}>
              <button
                type="button"
                aria-haspopup="dialog"
                data-print="text"
                onClick={show({ kind: "ability", ability: a })}
                className={`${statButton} w-full rounded-lg border border-line bg-panel px-2 py-2 text-center`}
              >
                <span className="block truncate text-xs font-semibold uppercase tracking-wide text-muted">{ABILITY_NAMES[a]}</span>
                <span className="block font-heading text-2xl font-extrabold leading-tight">{fmtMod(d.abilities[a].mod)}</span>
                <span className="mx-auto mt-0.5 block w-10 rounded-full border border-line bg-surface text-sm font-bold">{d.abilities[a].score}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Franja de combate: PG y cuatro fichas compactas (en móvil, PG a todo el ancho y las fichas en 2 × 2) */}
      <section
        aria-label="Valores de combate"
        className="grid animate-fade-up gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]"
        style={{ animationDelay: "50ms" }}
      >
        <div className="rounded-md border border-line bg-surface px-3 py-3 text-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Puntos de golpe</p>
          {isOwner ? (
            <HpEditor characterId={characterId} max={d.hp.max} current={d.hp.current} temp={d.hp.temp} />
          ) : (
            <p className="font-heading text-2xl font-extrabold">
              {Math.min(d.hp.current, d.hp.max)}
              <span className="text-base font-bold text-muted"> / {d.hp.max}</span>
              {d.hp.temp > 0 && <span className="ml-1 text-base text-success">+{d.hp.temp}</span>}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 content-start gap-3 sm:grid-cols-4">
          <button
            type="button"
            aria-haspopup="dialog"
            data-print="text"
            onClick={show({ kind: "ac" })}
            className={`${chip} ${statButton}`}
          >
            <span className={chipLabel}>
              CA
              {d.armorWarning && (
                <TriangleAlert size={12} className="text-brand-soft" role="img" aria-label={d.armorWarning} />
              )}
            </span>
            <span className={chipValue}>{d.ac}</span>
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            data-print="text"
            onClick={show({ kind: "initiative" })}
            className={`${chip} ${statButton}`}
          >
            <span className={chipLabel}>Iniciativa</span>
            <span className={chipValue}>{fmtMod(d.initiative)}</span>
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            data-print="text"
            onClick={show({ kind: "speed" })}
            className={`${chip} ${statButton}`}
          >
            <span className={chipLabel}>Velocidad</span>
            <span className={chipValue}>{d.speed} pies</span>
          </button>
          <div className={chip}>
            <span className={chipLabel}>Competencia</span>
            <span className={chipValue}>{fmtMod(d.proficiencyBonus)}</span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className={`${card} animate-fade-up`} style={{ animationDelay: "100ms" }}>
          <h3 className={cardTitle}>Tiradas de salvación</h3>
          <ul className="divide-y divide-line">
            {d.saves.map((s) => (
              <li key={s.ability}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  data-print="text"
                  onClick={show({ kind: "save", ability: s.ability })}
                  className={`${statButton} flex w-full items-center gap-3 rounded px-1 py-2 text-left`}
                >
                  <ProficiencyDot level={s.proficient ? 1 : 0} />
                  <span className="flex-1">{ABILITY_NAMES[s.ability]}</span>
                  <span className="font-heading font-bold">{fmtMod(s.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${card} animate-fade-up`} style={{ animationDelay: "150ms" }}>
          <h3 className={cardTitle}>Habilidades</h3>
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {skills.map((s) => (
              <li key={s.id} className="border-b border-line">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  data-print="text"
                  onClick={show({ kind: "skill", id: s.id, ability: s.ability })}
                  className={`${statButton} flex w-full items-center gap-3 rounded px-1 py-1.5 text-left`}
                >
                  <ProficiencyDot level={s.proficiency} />
                  <span className="min-w-0 flex-1 truncate">
                    {skillName(s.id)} <span className="text-xs text-muted">({ABILITY_ABBR[s.ability]})</span>
                  </span>
                  {PASSIVE_SKILLS.includes(s.id) && (
                    <span className="shrink-0 text-xs text-muted">Pasiva {10 + s.total}</span>
                  )}
                  <span className="font-heading font-bold">{fmtMod(s.total)}</span>
                </button>
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

      {open && (
        <StatDialog
          {...detail(open.stat)}
          onClose={() => setOpen(null)}
          opener={open.opener}
        />
      )}
    </div>
  );
}
