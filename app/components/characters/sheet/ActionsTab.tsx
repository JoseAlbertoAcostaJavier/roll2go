import { Fragment } from "react";
import { ChevronDown } from "lucide-react";
import type { CatalogEntry, SpellOption } from "@/lib/rules/catalog/types";
import type { ActionsSummary } from "@/lib/rules/dnd2024/derive/actions";
import { actionSections, sectionVisibility, type ActionFilter, type ActionSection, type SectionVisibility } from "@/lib/rules/dnd2024/sheet/actionFilters";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { DAMAGE_TYPE_NAMES, fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { spellLevelLabel } from "@/lib/rules/dnd2024/spells/spellTextClient";
import { iconSrc } from "@/lib/utils/icons";
import { sheetCard } from "@/app/components/ui/formStyles";
import MaskIcon from "@/app/components/ui/MaskIcon";
import ActionsDialogs, { BasicActionButton, SpellLink, type BasicActionInfo } from "./ActionsDialogs";
import ActionsFilters from "./ActionsFilters";
import { Description } from "./FeaturesTab";

type Props = {
  characterId: string;
  /** La pestaña está a la vista (monta la ficha de conjuro). */
  active: boolean;
  summary: ActionsSummary;
  filter: ActionFilter;
  /** Dirección de la ficha y parámetros actuales, para los chips de filtro. */
  base: string;
  query: Record<string, string | string[] | undefined>;
  /** Catálogo del personaje: descripción de los rasgos. */
  entries: Map<string, CatalogEntry>;
  /** Conjuros de las filas (cabecera de su ficha mientras llega la descripción). */
  spells: SpellOption[];
  basics: BasicActionInfo[];
};

const SPELL_ICON = iconSrc("action", "cast-spell");

// Tabla de ataques: armas y conjuros con tirada; se desplaza dentro de su caja en móvil
function AttackTable({ rows }: { rows: ActionSection["attacks"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="py-2 pr-3 font-semibold">Ataque</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Alcance</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Golpe/CD</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Daño</th>
            <th scope="col" className="py-2 font-semibold">Notas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => {
            if (r.kind === "attack") {
              const a = r.attack;
              return (
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
              );
            }
            // Conjuro: el catálogo no guarda sus dados de daño, así que solo se muestra el tipo
            return (
              <tr key={refKey(r.ref)}>
                <th scope="row" className="py-2 pr-3 font-semibold">
                  <span className="flex items-center gap-2">
                    <MaskIcon src={SPELL_ICON} size={18} label="Conjuro" className="text-muted" />
                    <span>
                      <SpellLink spellRef={r.ref} name={r.name} />
                      <span className="block text-xs font-normal text-muted">{spellLevelLabel(r.level)}</span>
                    </span>
                  </span>
                </th>
                <td className="py-2 pr-3 whitespace-nowrap">{r.range}</td>
                <td className="py-2 pr-3 whitespace-nowrap font-heading font-bold">{r.hit}</td>
                <td className="py-2 pr-3">
                  {r.damage || r.damageTypeId ? (
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      {r.damage}
                      <MaskIcon src={iconSrc("damageType", r.damageTypeId)} size={16} className="text-muted" />
                      {r.damageTypeId && <span className="text-xs text-muted">{DAMAGE_TYPE_NAMES[r.damageTypeId] ?? r.damageTypeId}</span>}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="py-2 text-muted">{r.notes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Lo que el filtro oculta en pantalla sigue en el documento y sale al imprimir
const hide = (visible: boolean) => (visible ? "" : "hidden print:block");

function Section({ section, vis, attacksPerAction, entries }: {
  section: ActionSection; vis: SectionVisibility; attacksPerAction: number; entries: Map<string, CatalogEntry>;
}) {
  const { attacks, spells, features, basics } = section;
  return (
    <section className={`${sheetCard} animate-fade-up space-y-4 ${hide(vis.section)}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="border-l-4 border-brand pl-3 font-heading text-xl font-bold">{section.title}</h3>
        {section.group === "action" && (
          <p className="text-sm text-muted">Ataques por acción: <span className="font-heading font-bold text-fg">{attacksPerAction}</span></p>
        )}
      </div>

      {attacks.length > 0 && (
        <div className={hide(vis.attacks)}>
          <AttackTable rows={attacks} />
        </div>
      )}

      {/* Conjuros sin tirada: nombre (abre su ficha), nivel, alcance y de dónde salen */}
      {spells.length > 0 && (
        <ul className={`divide-y divide-line border-y border-line ${hide(vis.spells)}`}>
          {spells.map((s) => (
            <li key={refKey(s.ref)} className="flex items-center gap-3 py-2 text-sm">
              <MaskIcon src={SPELL_ICON} size={18} label="Conjuro" className="text-muted" />
              <span className="min-w-0 flex-1">
                <SpellLink spellRef={s.ref} name={s.name} />
                <span className="block text-xs text-muted">
                  {[spellLevelLabel(s.level), s.range, s.notes].filter(Boolean).join(" · ")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Rasgos: plegables con su descripción, como en Rasgos */}
      {features.length > 0 && (
        <ul className={`divide-y divide-line border-y border-line ${hide(vis.features)}`}>
          {features.map((f, i) => (
            <li key={`${refKey(f.ref)}-${i}`}>
              <details className="group/feat">
                <summary className="flex cursor-pointer list-none items-center gap-3 py-3 hover:text-white">
                  <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-muted transition-transform group-open/feat:rotate-180" />
                  <span className="flex-1 font-semibold">{f.name}</span>
                  <span className="shrink-0 text-xs uppercase tracking-wide text-muted">{f.source}</span>
                </summary>
                <div className="pb-4 pl-7">
                  <Description entry={entries.get(refKey(f.ref))} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      {basics.length > 0 && (
        <div className={`text-sm ${hide(vis.basics)}`}>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Acciones en combate</h4>
          <p>
            {basics.map((b, i) => (
              <Fragment key={refKey(b.ref)}>
                {i > 0 && ", "}
                <BasicActionButton actionKey={refKey(b.ref)} name={b.name} />
              </Fragment>
            ))}
          </p>
        </div>
      )}
    </section>
  );
}

// Pestaña Acciones (spec de acciones §4): filtros y, por lo que cuesta usarlos, armas, conjuros, rasgos y acciones
// básicas de combate
export default function ActionsTab({ characterId, active, summary, filter, base, query, entries, spells, basics }: Props) {
  // Siempre todas las secciones: el filtro solo decide qué se ve en pantalla, la hoja impresa sale completa
  const sections = actionSections(summary, "todo");
  const shown = sections.some((s) => sectionVisibility(s, filter).section);
  return (
    <ActionsDialogs characterId={characterId} active={active} spells={spells} basics={basics}>
      <ActionsFilters base={base} query={query} active={filter} />
      {sections.length === 0 ? (
        <p className="text-sm text-muted">No hay acciones que mostrar.</p>
      ) : (
        <div className="space-y-6">
          {!shown && <p className="text-sm text-muted print:hidden">No hay acciones que mostrar.</p>}
          {sections.map((s) => (
            <Section key={s.group} section={s} vis={sectionVisibility(s, filter)} attacksPerAction={summary.attacksPerAction} entries={entries} />
          ))}
        </div>
      )}
    </ActionsDialogs>
  );
}
