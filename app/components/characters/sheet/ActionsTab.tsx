import { Star } from "lucide-react";
import { Fragment } from "react";
import type { CatalogEntry, SpellOption } from "@/lib/rules/catalog/types";
import type { ActionsSummary } from "@/lib/rules/dnd2024/derive/actions";
import { actionSections, sectionVisibility, type ActionFilter, type ActionSection, type SectionVisibility } from "@/lib/rules/dnd2024/sheet/actionFilters";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { ItemDetails } from "@/lib/rules/dnd2024/sheet/itemDetails";
import { DAMAGE_TYPE_NAMES, fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { iconSrc } from "@/lib/utils/icons";
import MaskIcon from "@/app/components/ui/MaskIcon";
import UntranslatedTag from "@/app/components/ui/UntranslatedTag";
import ActionsDialogs, { BasicActionButton, FeatureButton, ItemButton, SpellLink, type BasicActionInfo, type FeatureInfo } from "./ActionsDialogs";
import ActionsFilters from "./ActionsFilters";
import FeatureUsesControl from "./FeatureUsesControl";
import { SectionBar, plainText } from "./statUi";

type Props = {
  characterId: string;
  /** Solo el dueño marca los usos de los rasgos. */
  isOwner: boolean;
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
  /** Fichas y descripciones de las líneas del inventario, para abrir la de cada arma. */
  itemCards: Record<string, ItemDetails>;
  itemDescriptions: Record<string, string>;
};

const SPELL_ICON = iconSrc("action", "cast-spell");
// Icono de la escuela del conjuro (blanco, como los demás); sin él, el genérico
const schoolIcon = (school: string) => iconSrc("darkSchool", school) ?? SPELL_ICON;

// Rótulo de un dato: solo se ve en la tarjeta de móvil (desde md las cabeceras de columna lo dicen)
const label = "block font-sans text-[11px] font-normal uppercase tracking-wide text-muted md:hidden print:hidden";
// En móvil (y no al imprimir) la fila es una tarjeta: nombre a la izquierda, datos a la derecha
const card = "max-md:not-print:grid max-md:not-print:grid-cols-[minmax(0,1fr)_auto_auto] max-md:not-print:gap-x-4 max-md:not-print:gap-y-1 max-md:not-print:py-3";
const cardName = "max-md:not-print:col-start-1 max-md:not-print:row-span-2 max-md:not-print:row-start-1";
const cardStat = "max-md:not-print:p-0 max-md:not-print:text-right max-md:not-print:font-heading max-md:not-print:text-xl max-md:not-print:font-bold";
const cardHit = `${cardStat} max-md:not-print:col-start-2 max-md:not-print:row-start-1`;
const cardDamage = `${cardStat} max-md:not-print:col-start-3 max-md:not-print:row-start-1 max-md:not-print:max-w-40`;
const cardRange = "max-md:not-print:col-span-2 max-md:not-print:col-start-2 max-md:not-print:row-start-2 max-md:not-print:p-0 max-md:not-print:text-right max-md:not-print:text-xs";

// Tabla de ataques: armas y conjuros con tirada (también los de curación). En móvil cada fila es una tarjeta (mismo DOM,
// solo CSS); las notas van bajo el nombre. Al cambiar el display de tabla se pierde su semántica: los roles la mantienen.
function AttackTable({ rows }: { rows: ActionSection["attacks"] }) {
  return (
    <div className="md:overflow-x-auto">
      <table role="table" className="w-full text-left text-sm max-md:not-print:block md:min-w-[28rem]">
        <thead role="rowgroup" className="text-xs text-muted max-md:not-print:sr-only">
          <tr role="row">
            <th role="columnheader" scope="col" className="px-3 py-2 font-semibold">Ataque</th>
            <th role="columnheader" scope="col" className="py-2 pr-3 font-semibold">Alcance</th>
            <th role="columnheader" scope="col" className="py-2 pr-3 font-semibold">Golpe/CD</th>
            <th role="columnheader" scope="col" className="py-2 font-semibold">Daño</th>
          </tr>
        </thead>
        <tbody role="rowgroup" className="divide-y divide-line max-md:not-print:block">
          {rows.map((r, i) => {
            if (r.kind === "attack") {
              const a = r.attack;
              return (
                <tr role="row" key={`${a.name}-${i}`} data-search={a.name} className={card}>
                  <th role="rowheader" scope="row" className={`px-3 py-2 font-semibold text-white ${cardName} max-md:not-print:p-0`}>
                    <span className="flex items-center gap-2">
                      <span className="relative inline-flex shrink-0">
                        <MaskIcon
                          src={iconSrc("weaponType", a.kind)}
                          size={18}
                          label={a.kind === "ranged" ? "A distancia" : "Cuerpo a cuerpo"}
                          className="text-muted"
                        />
                        {a.mastery && (
                          <Star
                            size={9}
                            role="img"
                            aria-label={`Maestría: ${a.mastery}`}
                            className="absolute -right-1 -top-1 fill-brand-soft text-brand-soft"
                          />
                        )}
                      </span>
                      {a.lineId ? <ItemButton lineId={a.lineId} name={a.name} /> : <span>{a.name}</span>}
                    </span>
                    <span className="block text-xs font-normal text-muted">{[a.kind === "ranged" ? "A distancia" : "Cuerpo a cuerpo", a.notes].filter(Boolean).join(" · ")}</span>
                  </th>
                  <td role="cell" className={`py-2 pr-3 md:whitespace-nowrap ${cardRange}`}>
                    <span className={`${label} max-md:not-print:mr-1 max-md:not-print:inline`}>Alcance</span>
                    {a.range}
                  </td>
                  <td role="cell" className={`py-2 pr-3 font-heading font-bold text-success ${cardHit}`}>
                    <span className={label}>Golpe</span>
                    {fmtMod(a.bonus)}
                  </td>
                  <td role="cell" className={`py-2 font-semibold text-brand-soft ${cardDamage}`}>
                    <span className={label}>Daño</span>
                    <span className="flex max-md:not-print:flex-wrap items-center gap-x-1.5 max-md:not-print:justify-end md:whitespace-nowrap">
                      {a.damage}
                      <MaskIcon src={iconSrc("damageType", a.damageTypeId)} size={16} className="text-brand-soft" />
                      {a.damageType && <span className="font-sans text-xs font-normal text-muted">{a.damageType}</span>}
                    </span>
                  </td>
                </tr>
              );
            }
            return (
              <tr role="row" key={refKey(r.ref)} data-search={r.name} className={card}>
                <th role="rowheader" scope="row" className={`px-3 py-2 font-semibold text-white ${cardName} max-md:not-print:p-0`}>
                  <span className="flex items-center gap-2">
                    <MaskIcon src={schoolIcon(r.school)} size={18} label="Conjuro" className="text-muted" />
                    <span>
                      <SpellLink spellRef={r.ref} name={r.name} />
                      <span className="block text-xs font-normal text-muted">{r.subtitle}</span>
                    </span>
                  </span>
                  {r.notes && <span className="mt-0.5 block text-xs font-normal text-muted">{r.notes}</span>}
                </th>
                <td role="cell" className={`py-2 pr-3 md:whitespace-nowrap ${cardRange}`}>
                  <span className={`${label} max-md:not-print:mr-1 max-md:not-print:inline`}>Alcance</span>
                  {r.range}
                </td>
                <td role="cell" className={`py-2 pr-3 font-heading font-bold text-success md:whitespace-nowrap ${cardHit}`}>
                  <span className={label}>Golpe</span>
                  {r.hit ?? <span className="font-normal text-muted">—</span>}
                </td>
                <td role="cell" className={`py-2 font-semibold text-brand-soft ${cardDamage}`}>
                  <span className={label}>Daño</span>
                  {r.damage || r.damageTypeId ? (
                    <span className="flex max-md:not-print:flex-wrap items-center gap-x-1.5 max-md:not-print:justify-end md:whitespace-nowrap">
                      {r.damage}
                      {r.healing ? <span className="font-sans text-xs font-normal text-muted">Curación</span> : (
                        <>
                          <MaskIcon src={iconSrc("damageType", r.damageTypeId)} size={16} className="text-muted" />
                          {r.damageTypeId && <span className="font-sans text-xs font-normal text-muted">{DAMAGE_TYPE_NAMES[r.damageTypeId] ?? r.damageTypeId}</span>}
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="font-normal text-muted">—</span>
                  )}
                </td>
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

function Section({ section, vis, attacksPerAction, characterId, isOwner, entries }: {
  section: ActionSection; vis: SectionVisibility; attacksPerAction: number; characterId: string; isOwner: boolean; entries: Map<string, CatalogEntry>;
}) {
  const { attacks, spells, features, basics } = section;
  return (
    <section data-search-group className={`animate-fade-up space-y-1 ${hide(vis.section)}`}>
      <SectionBar title={section.title} extra={section.group === "action" ? <>Ataques por acción: <span className="font-heading font-bold text-fg">{attacksPerAction}</span></> : undefined} />

      {attacks.length > 0 && (
        <div className={hide(vis.attacks)}>
          <AttackTable rows={attacks} />
        </div>
      )}

      {/* Conjuros sin tirada: nombre (abre su ficha), nivel, alcance y de dónde salen */}
      {spells.length > 0 && (
        <ul className={`divide-y divide-line ${hide(vis.spells)}`}>
          {spells.map((s) => (
            <li key={refKey(s.ref)} data-search={s.name} className="flex items-center gap-3 px-3 py-2 text-sm">
              <MaskIcon src={schoolIcon(s.school)} size={18} label="Conjuro" className="text-muted" />
              <span className="min-w-0 flex-1">
                <SpellLink spellRef={s.ref} name={s.name} />
                <span className="block text-xs text-muted">
                  {[s.subtitle, s.range, s.notes].filter(Boolean).join(" · ")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Rasgos: el nombre abre su descripción; con usos, los cuadrados debajo */}
      {features.length > 0 && (
        <ul className={`divide-y divide-line ${hide(vis.features)}`}>
          {features.map((f, i) => (
            <li key={`${refKey(f.ref)}-${i}`} data-search={f.name} className="grid gap-x-4 gap-y-1 px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
              <div className="min-w-0">
                <FeatureButton featureKey={f.uses?.key ?? refKey(f.ref)} name={f.name} />
                {entries.has(refKey(f.ref)) && !entries.get(refKey(f.ref))!.nameEs && <UntranslatedTag className="ml-2" />}
                {f.special && <span className="ml-2 text-muted">(Especial)</span>}
                <span className="block text-xs text-brand-soft">{f.source}</span>
                {f.uses && <FeatureUsesControl characterId={characterId} use={f.uses} isOwner={isOwner} className="mt-1.5" />}
              </div>
              <p className="line-clamp-2 min-w-0 text-muted print:hidden">{(() => {
                const e = entries.get(refKey(f.ref));
                return e ? plainText(e.descriptionEs || e.description) : "";
              })()}</p>
            </li>
          ))}
        </ul>
      )}

      {basics.length > 0 && (
        <div data-search="acciones en combate" className={`grid gap-x-4 gap-y-1 px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] ${hide(vis.basics)}`}>
          <h4 className="font-semibold text-white">Acciones en combate</h4>
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
export default function ActionsTab({ characterId, isOwner, active, summary, filter, base, query, entries, spells, basics, itemCards, itemDescriptions }: Props) {
  // Siempre todas las secciones: el filtro solo decide qué se ve en pantalla, la hoja impresa sale completa
  const sections = actionSections(summary, "todo");
  const shown = sections.some((s) => sectionVisibility(s, filter).section);
  const features: FeatureInfo[] = sections.flatMap((s) => s.features).map((f) => {
    const e = entries.get(refKey(f.ref));
    // Una especie con varios contadores repite el ref: la clave de cada uno es la de su contador
    return { key: f.uses?.key ?? refKey(f.ref), name: f.name, source: f.source, description: e ? e.descriptionEs || e.description : "" };
  });
  return (
    <ActionsDialogs characterId={characterId} active={active} spells={spells} basics={basics} features={features} itemCards={itemCards} itemDescriptions={itemDescriptions}>
      <ActionsFilters base={base} query={query} active={filter} />
      {sections.length === 0 ? (
        <p className="text-sm text-muted">No hay acciones que mostrar.</p>
      ) : (
        <div className="space-y-5">
          {!shown && <p className="text-sm text-muted print:hidden">No hay acciones que mostrar.</p>}
          {sections.map((s) => (
            <Section key={s.group} section={s} vis={sectionVisibility(s, filter)} attacksPerAction={summary.attacksPerAction} characterId={characterId} isOwner={isOwner} entries={entries} />
          ))}
        </div>
      )}
    </ActionsDialogs>
  );
}
