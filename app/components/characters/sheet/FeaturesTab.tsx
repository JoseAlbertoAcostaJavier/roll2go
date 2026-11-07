import { Fragment } from "react";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { FeatureGroup } from "@/lib/rules/dnd2024/derive";
import type { FeatureUse } from "@/lib/rules/dnd2024/derive/featureUses";
import { bareName, refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { featureReference } from "@/lib/rules/dnd2024/sheet/labels";
import { FEATURE_SECTION_CHIPS, featureSections, parseSection } from "@/lib/rules/dnd2024/sheet/sheetSections";
import type { Ref } from "@/lib/rules/types";
import Bbcode from "@/app/components/ui/Bbcode";
import { sheetCard } from "@/app/components/ui/formStyles";
import RoundIcon from "@/app/components/ui/RoundIcon";
import UntranslatedTag from "@/app/components/ui/UntranslatedTag";
import Collapsible from "./Collapsible";
import FeatureUsesControl from "./FeatureUsesControl";
import SectionChips from "./SectionChips";

type Query = Record<string, string | string[] | undefined>;
type Props = {
  groups: FeatureGroup[]; entries: Map<string, CatalogEntry>; base: string; query: Query;
  featureUses: FeatureUse[]; characterId: string; isOwner: boolean;
};

const descriptionOf = (e: CatalogEntry | undefined) => (e ? e.descriptionEs || e.description : "");

export function Description({ entry, missing }: { entry: CatalogEntry | undefined; missing?: string }) {
  if (!entry) return <p className="text-sm text-muted">{missing ?? "Contenido no disponible."}</p>;
  const text = descriptionOf(entry);
  return text ? <Bbcode source={text} className="text-sm" /> : <p className="text-sm text-muted">Sin descripción.</p>;
}

// Identificador de la entrada (o de su entrada padre: la especie de un legado, la clase de una subclase)
const idOf = (entry: CatalogEntry | undefined, ref: Ref | null) => entry?.identifier || bareName(ref?.key ?? "");

const Reference = ({ text }: { text: string | null }) =>
  text ? <span className="block text-xs text-muted">{text}</span> : null;

function GroupHeading({ group, entry }: { group: FeatureGroup; entry: CatalogEntry | undefined }) {
  const title = entry ? (entry.nameEs ?? entry.name) : group.title;
  const reference = featureReference(entry);
  if (group.source === "class") {
    return (
      <div className="flex items-center gap-3">
        <RoundIcon kind="class" id={idOf(entry, group.ref)} label={title} size={48} />
        <div>
          <h3 className="font-heading text-xl font-bold">{title} <span className="text-muted">Nivel {group.level}</span></h3>
          <Reference text={reference} />
        </div>
      </div>
    );
  }
  const kind = { species: "Especie", lineage: "Legado", subclass: "Subclase", option: "", feat: "", class: "" }[group.source];
  const icon = group.source === "species" ? <RoundIcon kind="species" id={idOf(entry, group.ref)} label={title} size={40} />
    : group.source === "lineage" && entry?.parent ? <RoundIcon kind="species" id={bareName(entry.parent.key)} label={title} size={40} />
    : group.source === "subclass" && entry?.parent ? <RoundIcon kind="class" id={bareName(entry.parent.key)} label={title} size={40} />
    : null;
  // Dotes, invocaciones y el resto: iconos de grupo
  const feature = group.source === "feat" ? "feats" : group.progression?.includes("invocation") ? "invocations" : "others";
  return (
    <div className="flex items-center gap-3">
      {icon ?? <RoundIcon kind="feature" id={feature} label={title} size={40} />}
      <div>
        <h3 className="font-heading text-xl font-bold">
          {title}
          {kind && <span className="ml-2 text-sm font-semibold uppercase tracking-wide text-muted">{kind}</span>}
        </h3>
        <Reference text={reference} />
      </div>
    </div>
  );
}

// Rasgos por origen en tres secciones (clase, especie, dotes) con chips de filtro. Lo que el filtro oculta sigue en el
// DOM (`hidden print:block`) para que la impresión lo saque todo. Cada rasgo y cada introducción de grupo se pliega
// (`Collapsible`) con su referencia «Libro, pág. N» a la vista; impresa, la descripción sale completa.
export default function FeaturesTab({ groups, entries, base, query, featureUses, characterId, isOwner }: Props) {
  const usesByKey = new Map(featureUses.map((u) => [u.key, u]));
  const usesOf = (ref: Ref | null) => (ref ? usesByKey.get(refKey(ref)) : undefined);
  const get = (ref: Ref | null) => (ref ? entries.get(refKey(ref)) : undefined);

  if (groups.length === 0) return <p className="text-sm text-muted">Este personaje no tiene rasgos.</p>;

  const active = parseSection(query.seccion, FEATURE_SECTION_CHIPS.map((c) => c.id));
  const visible = new Set(featureSections(groups, active).map((s) => s.id));
  let gi = 0;

  return (
    <div>
      <SectionChips chips={FEATURE_SECTION_CHIPS} active={active} base={base} query={query} label="Filtrar rasgos" />
      <div className="space-y-8">
        {featureSections(groups, "todo").map((sec) => (
          <section key={sec.id} aria-label={sec.title} className={visible.has(sec.id) ? "" : "hidden print:block"}>
            <h2 className="mb-3 font-heading text-sm font-bold uppercase tracking-wide text-brand-soft">{sec.title}</h2>
            <div className="space-y-6">
              {sec.groups.map((g) => {
                const entry = get(g.ref);
                const n = gi++;
                // Grupos sin rasgos propios (especie, legado): un contador por cada uso de su rasgo
                const groupUses = g.features.length === 0 && g.ref
                  ? featureUses.filter((u) => u.key === refKey(g.ref!) || u.owner === refKey(g.ref!)) : [];
                return (
                  <article key={`${g.source}-${g.ref ? refKey(g.ref) : n}`} className={`${sheetCard} animate-fade-up`} style={{ animationDelay: `${Math.min(n, 6) * 50}ms` }}>
                    <GroupHeading group={g} entry={entry} />
                    {groupUses.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {groupUses.map((u) => (
                          <FeatureUsesControl key={u.key} characterId={characterId} use={u} isOwner={isOwner} showName />
                        ))}
                      </div>
                    )}
                    {g.ref && !entry && <p className="mt-4 text-sm text-muted">Contenido no disponible.</p>}
                    {g.ref && descriptionOf(entry) && (
                      <Collapsible className="mt-4" header={<span key="header" className="text-sm font-semibold text-brand-soft">Descripción{!entry?.descriptionEs && <UntranslatedTag className="ml-2" />}</span>}>
                        <Description key="description" entry={entry} />
                      </Collapsible>
                    )}

                    {g.features.length > 0 && (
                      <ul className="mt-4 divide-y divide-line border-y border-line">
                        {g.features.map((f, i) => (
                          <li key={`${refKey(f.ref)}-${i}`} className="py-3">
                            <Collapsible
                              header={
                                // Con `key`: React comprueba los elementos que se pasan a un componente de cliente dentro de un `map`
                                <Fragment key="header">
                                  <span className="flex items-baseline gap-3">
                                    <span className="flex-1 font-semibold">
                                      {f.name}
                                      {get(f.ref) && !get(f.ref)!.nameEs && <UntranslatedTag className="ml-2" />}
                                      {f.chosen && <span className="ml-2 font-normal text-brand-soft">{f.chosen.join(", ")}</span>}
                                    </span>
                                    {f.value && <span className="text-sm text-success">{f.value}</span>}
                                    <span className="shrink-0 text-xs uppercase tracking-wide text-muted">· Nivel {f.level}</span>
                                  </span>
                                  <Reference text={featureReference(get(f.ref))} />
                                </Fragment>
                              }
                              aside={usesOf(f.ref) && (
                                <FeatureUsesControl key="uses" characterId={characterId} use={usesOf(f.ref)!} isOwner={isOwner} className="mt-2" />
                              )}
                            >
                              <Description key="description" entry={get(f.ref)} />
                            </Collapsible>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
