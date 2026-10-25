import { ChevronDown } from "lucide-react";
import type { CatalogEntry } from "@/lib/rules/catalog";
import type { FeatureGroup } from "@/lib/rules/dnd2024/derive";
import { bareName, refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import type { Ref } from "@/lib/rules/types";
import Bbcode from "@/app/components/Bbcode";
import { card } from "@/app/components/formStyles";
import RoundIcon from "@/app/components/RoundIcon";

type Props = { groups: FeatureGroup[]; entries: Map<string, CatalogEntry> };

const descriptionOf = (e: CatalogEntry | undefined) => (e ? e.descriptionEs || e.description : "");

function Description({ entry, missing }: { entry: CatalogEntry | undefined; missing?: string }) {
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

// Rasgos por origen: especie, legado, cada clase y subclase, rasgos opcionales elegidos y dotes. Cada rasgo es
// plegable; el primero, abierto.
export default function FeaturesTab({ groups, entries }: Props) {
  const get = (ref: Ref | null) => (ref ? entries.get(refKey(ref)) : undefined);

  if (groups.length === 0) return <p className="text-sm text-muted">Este personaje no tiene rasgos.</p>;

  return (
    <div className="space-y-6">
      {groups.map((g, gi) => {
        const entry = get(g.ref);
        // La descripción del grupo: la de la especie o el legado completa; la de la clase o subclase, plegada
        const longIntro = g.source === "class" || g.source === "subclass";
        return (
          <section key={`${g.source}-${g.ref ? refKey(g.ref) : gi}`} className={`${card} animate-fade-up`} style={{ animationDelay: `${Math.min(gi, 6) * 50}ms` }}>
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
                  <Description entry={entry} />
                )}
              </div>
            )}

            {g.features.length > 0 && (
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {g.features.map((f, i) => (
                  <li key={`${refKey(f.ref)}-${i}`}>
                    <details open={i === 0} className="group/feat">
                      <summary className="flex cursor-pointer list-none items-center gap-3 py-3 hover:text-white">
                        <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-muted transition-transform group-open/feat:rotate-180" />
                        <span className="flex-1 font-semibold">
                          {f.name}
                          {f.chosen && <span className="ml-2 font-normal text-brand-soft">{f.chosen.join(", ")}</span>}
                        </span>
                        {f.value && <span className="text-sm text-success">{f.value}</span>}
                        <span className="shrink-0 text-xs uppercase tracking-wide text-muted">Nivel {f.level}</span>
                      </summary>
                      <div className="pb-4 pl-7">
                        <Description entry={get(f.ref)} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
