import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { FeatureGroup } from "@/lib/rules/dnd2024/derive";
import type { FeatureUse } from "@/lib/rules/dnd2024/derive/featureUses";
import type { SheetCustom } from "@/lib/rules/dnd2024/sheet/custom";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { featureSections, parseSection, sectionHref } from "@/lib/rules/dnd2024/sheet/sheetSections";
import type { FeatureData, Ref } from "@/lib/rules/types";
import Bbcode from "@/app/components/ui/Bbcode";
import UntranslatedTag from "@/app/components/ui/UntranslatedTag";
import Collapsible from "./Collapsible";
import FeatureUsesControl from "./FeatureUsesControl";
import OrderedSection, { type OrderedRow } from "./OrderedSection";
import PanelSearch from "./PanelSearch";
import ShowSelect from "./ShowSelect";
import { plainText, tagChip } from "./statUi";

type Query = Record<string, string | string[] | undefined>;
type Props = {
  groups: FeatureGroup[]; entries: Map<string, CatalogEntry>; base: string; query: Query;
  featureUses: FeatureUse[]; characterId: string; isOwner: boolean; custom: SheetCustom;
};

const descriptionOf = (e: CatalogEntry | undefined) => (e ? e.descriptionEs || e.description : "");

export function Description({ entry, missing }: { entry: CatalogEntry | undefined; missing?: string }) {
  if (!entry) return <p className="text-sm text-muted">{missing ?? "Contenido no disponible."}</p>;
  const text = descriptionOf(entry);
  return text ? <Bbcode source={text} className="text-sm" /> : <p className="text-sm text-muted">Sin descripción.</p>;
}

const SECTIONS = [
  { id: "todo", label: "Todo" },
  { id: "clase", label: "Rasgos de clase" },
  { id: "especie", label: "Rasgos de especie" },
  { id: "dotes", label: "Dotes" },
  { id: "otros", label: "Otros" },
] as const;
const ACTIVATION_LABELS: Record<string, string> = { action: "Acción", bonus: "Acción adicional", reaction: "Reacción" };
const GROUP_KIND: Partial<Record<FeatureGroup["source"], string>> = { class: "Clase", species: "Especie", lineage: "Legado", subclass: "Subclase" };

// Una fila: nombre, origen y coste a la izquierda; a la derecha, el resumen de la descripción, que desaparece al desplegarla
function Row({ name, source, chip, summary, entry, aside, extra, children }: {
  name: string; source: string; chip?: string; summary: string; entry?: CatalogEntry;
  aside?: React.ReactNode; extra?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="px-3 py-2.5">
      <Collapsible
        header={(
          <span key="header" className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            <span className="min-w-0">
              <span className="font-semibold text-white">
                {name}
                {entry && !entry.nameEs && <UntranslatedTag className="ml-2" />}
              </span>
              {extra}
              {source && <span className="block text-xs text-brand-soft">{source}</span>}
              {chip && <span className={`${tagChip} mt-1 inline-block text-[11px]!`}>{chip}</span>}
            </span>
            <span className="line-clamp-2 min-w-0 text-muted group-aria-expanded:hidden print:hidden">{summary}</span>
          </span>
        )}
        aside={aside}
      >
        {children}
      </Collapsible>
    </div>
  );
}

// Pestaña Rasgos: una lista por sección, con buscador y filtro. Lo que el filtro oculta sigue en el documento para que la
// impresión lo saque todo, con las descripciones desplegadas.
export default function FeaturesTab({ groups, entries, base, query, featureUses, characterId, isOwner, custom }: Props) {
  const usesByKey = new Map(featureUses.map((u) => [u.key, u]));
  const get = (ref: Ref | null) => (ref ? entries.get(refKey(ref)) : undefined);
  const active = parseSection(query.seccion, SECTIONS.map((c) => c.id));
  const common = { custom, characterId, isOwner };
  const customRows = (section: string): OrderedRow[] => custom.items.flatMap((c): OrderedRow[] => (c.kind !== "feature" || c.section !== section ? [] : [{
    key: `custom:${c.id}`,
    customId: c.id,
    label: c.name,
    node: (
      <Row name={c.name} source={c.source} summary={c.description}>
        <p className="whitespace-pre-wrap text-sm text-muted">{c.description || "Sin descripción."}</p>
      </Row>
    ),
  }]));

  const rowsOf = (g: FeatureGroup, n: number): OrderedRow[] => {
    const entry = get(g.ref);
    const title = entry ? (entry.nameEs ?? entry.name) : g.title;
    // Grupos sin rasgos propios (especie, legado): un contador por cada uso de su rasgo
    const groupUses = g.features.length === 0 && g.ref
      ? featureUses.filter((u) => u.key === refKey(g.ref!) || u.owner === refKey(g.ref!)) : [];
    const groupRow: OrderedRow[] = g.ref && (descriptionOf(entry) || !entry || groupUses.length > 0) ? [{
      key: `group:${refKey(g.ref)}`,
      label: title,
      node: (
        <Row
          name={title}
          source={[GROUP_KIND[g.source], g.source === "class" ? `Nivel ${g.level}` : ""].filter(Boolean).join(" · ")}
          summary={plainText(descriptionOf(entry))}
          entry={entry}
          aside={groupUses.length > 0 && (
            <div key="uses" className="mt-1.5 space-y-1">
              {groupUses.map((u) => <FeatureUsesControl key={u.key} characterId={characterId} use={u} isOwner={isOwner} showName />)}
            </div>
          )}
        >
          <Description key="description" entry={entry} />
        </Row>
      ),
    }] : [];
    return [
      ...groupRow,
      ...g.features.map((f, i): OrderedRow => {
        const e = get(f.ref);
        const uses = usesByKey.get(refKey(f.ref));
        const activation = (e?.data as FeatureData | null | undefined)?.activation;
        return {
          key: `feature:${refKey(f.ref)}:${n}:${i}`,
          label: f.name,
          node: (
            <Row
              name={f.name}
              source={title}
              chip={typeof activation === "string" ? ACTIVATION_LABELS[activation] : undefined}
              summary={plainText(descriptionOf(e))}
              entry={e}
              extra={(
                <>
                  {f.chosen && <span className="ml-2 font-normal text-brand-soft">{f.chosen.join(", ")}</span>}
                  {f.value && <span className="ml-2 text-success">{f.value}</span>}
                </>
              )}
              aside={uses && <FeatureUsesControl key="uses" characterId={characterId} use={uses} isOwner={isOwner} className="mt-1.5" />}
            >
              <Description key="description" entry={e} />
            </Row>
          ),
        };
      }),
    ];
  };

  const sections = featureSections(groups, "todo");
  const of = (id: string) => sections.find((s) => s.id === id);
  const list = [
    { id: "clase", title: "Rasgos de clase" },
    { id: "especie", title: "Rasgos de especie" },
    { id: "dotes", title: "Dotes" },
    { id: "otros", title: "Otros" },
  ];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
        <PanelSearch label="Buscar rasgos" />
        <ShowSelect
          label="Mostrar rasgos"
          value={active}
          options={SECTIONS.map((s) => ({ id: s.id, label: s.label, href: `${base}${sectionHref(query, s.id)}` }))}
        />
      </div>
      <div className="space-y-5">
        {list.map((s) => (
          <OrderedSection
            {...common}
            key={s.id}
            id={`rasgos:${s.id}`}
            title={s.title}
            className={`animate-fade-up ${active === "todo" || active === s.id ? "" : "hidden print:block"}`}
            rows={[...(of(s.id)?.groups ?? []).flatMap((g, n) => rowsOf(g, n)), ...customRows(s.id)]}
            add={{ kind: "feature", group: s.id }}
            empty="Nada por aquí."
          />
        ))}
      </div>
    </div>
  );
}
