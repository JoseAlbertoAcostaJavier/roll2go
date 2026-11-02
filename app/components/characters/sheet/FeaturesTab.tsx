import { ChevronDown } from "lucide-react";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { FeatureGroup } from "@/lib/rules/dnd2024/derive";
import { bareName, refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { FEATURE_SECTION_CHIPS, featureSections, parseSection } from "@/lib/rules/dnd2024/sheet/sheetSections";
import type { Ref } from "@/lib/rules/types";
import Bbcode from "@/app/components/ui/Bbcode";
import { card } from "@/app/components/ui/formStyles";
import RoundIcon from "@/app/components/ui/RoundIcon";
import ClampedText from "./ClampedText";
import SectionChips from "./SectionChips";

type Query = Record<string, string | string[] | undefined>;
type Props = { groups: FeatureGroup[]; entries: Map<string, CatalogEntry>; base: string; query: Query };

const descriptionOf = (e: CatalogEntry | undefined) => (e ? e.descriptionEs || e.description : "");

export function Description({ entry, missing }: { entry: CatalogEntry | undefined; missing?: string }) {
  if (!entry) return <p className="text-sm text-muted">{missing ?? "Contenido no disponible."}</p>;
  const text = descriptionOf(entry);
  return text ? <Bbcode source={text} className="text-sm" /> : <p className="text-sm text-muted">Sin descripción.</p>;
}

// Identificador de la entrada (o de su entrada padre: la especie de un legado, la clase de una subclase)
const idOf = (entry: CatalogEntry | undefined, ref: Ref | null) => entry?.identifier || bareName(ref?.key ?? "");

function GroupHeading({ group, entry }: { group: FeatureGroup; entry: CatalogEntry | undefined }) {
  const title = entry ? (entry.nameEs ?? entry.name) : group.title;
  if (group.source === "class") {
    return (
      <div className="flex items-center gap-3">
        <RoundIcon kind="class" id={idOf(entry, group.ref)} label={title} size={48} />
        <h3 className="font-heading text-xl font-bold">{title} <span className="text-muted">Nivel {group.level}</span></h3>
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
      <h3 className="font-heading text-xl font-bold">
        {title}
        {kind && <span className="ml-2 text-sm font-semibold uppercase tracking-wide text-muted">{kind}</span>}
      </h3>
    </div>
  );
}

// Rasgos por origen en tres secciones (clase, especie, dotes) con chips de filtro. Lo que el filtro oculta sigue en el
// DOM (`hidden print:block`) para que la impresión lo saque todo. Cada rasgo lleva su descripción abierta, recortada
// si es larga.
export default function FeaturesTab({ groups, entries, base, query }: Props) {
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
                // La descripción del grupo: la de la especie o el legado completa; la de la clase o subclase, plegada
                const longIntro = g.source === "class" || g.source === "subclass";
                return (
                  <article key={`${g.source}-${g.ref ? refKey(g.ref) : n}`} className={`${card} animate-fade-up`} style={{ animationDelay: `${Math.min(n, 6) * 50}ms` }}>
                    <GroupHeading group={g} entry={entry} />
                    {g.ref && (
                      <div className="mt-4">
                        {longIntro ? (
                          descriptionOf(entry) && (
                            <details className="group/intro">
                              <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-brand-soft hover:text-white">
                                <ChevronDown size={16} aria-hidden="true" className="transition-transform group-open/intro:rotate-180" />
                                Descripción
                              </summary>
                              <div className="mt-2"><Description entry={entry} /></div>
                            </details>
                          )
                        ) : (
                          <ClampedText><Description entry={entry} /></ClampedText>
                        )}
                      </div>
                    )}

                    {g.features.length > 0 && (
                      <ul className="mt-4 divide-y divide-line border-y border-line">
                        {g.features.map((f, i) => (
                          <li key={`${refKey(f.ref)}-${i}`} className="py-3">
                            <div className="flex items-baseline gap-3">
                              <span className="flex-1 font-semibold">
                                {f.name}
                                {f.chosen && <span className="ml-2 font-normal text-brand-soft">{f.chosen.join(", ")}</span>}
                              </span>
                              {f.value && <span className="text-sm text-success">{f.value}</span>}
                              <span className="shrink-0 text-xs uppercase tracking-wide text-muted">· Nivel {f.level}</span>
                            </div>
                            <div className="mt-2">
                              <ClampedText><Description entry={get(f.ref)} /></ClampedText>
                            </div>
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
