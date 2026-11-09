import { Star } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import type { CatalogEntry, SpellOption } from "@/lib/rules/catalog/types";
import type { ActionsSummary } from "@/lib/rules/dnd2024/derive/actions";
import { ACTION_FILTERS, actionFilterHref, actionSections, sectionVisibility, type ActionFilter, type ActionSection } from "@/lib/rules/dnd2024/sheet/actionFilters";
import type { SheetCustom } from "@/lib/rules/dnd2024/sheet/custom";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { ItemAction } from "@/lib/rules/dnd2024/sheet/itemActions";
import type { ItemDetails } from "@/lib/rules/dnd2024/sheet/itemDetails";
import { DAMAGE_TYPE_NAMES, fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { iconSrc } from "@/lib/utils/icons";
import MaskIcon from "@/app/components/ui/MaskIcon";
import UntranslatedTag from "@/app/components/ui/UntranslatedTag";
import ActionsDialogs, { BasicActionButton, FeatureButton, ItemButton, SpellLink, type BasicActionInfo, type FeatureInfo } from "./ActionsDialogs";
import BasicActionsManager, { type BasicActionOption } from "./BasicActionsManager";
import FeatureUsesControl from "./FeatureUsesControl";
import OrderedSection, { type OrderedRow } from "./OrderedSection";
import PanelSearch from "./PanelSearch";
import ShowSelect from "./ShowSelect";
import { d20Expr, diceIn } from "@/lib/utils/diceText";
import { RollButton } from "./rolls";
import { plainText } from "./statUi";

type Query = Record<string, string | string[] | undefined>;
type Props = {
  characterId: string;
  /** Solo el dueño marca los usos de los rasgos. */
  isOwner: boolean;
  /** La pestaña está a la vista (monta la ficha de conjuro). */
  active: boolean;
  summary: ActionsSummary;
  filter: ActionFilter;
  /** Dirección de la ficha y parámetros actuales, para el filtro. */
  base: string;
  query: Query;
  /** Catálogo del personaje: descripción de los rasgos. */
  entries: Map<string, CatalogEntry>;
  /** Conjuros de las filas (cabecera de su ficha mientras llega la descripción). */
  spells: SpellOption[];
  basics: BasicActionInfo[];
  /** Acciones del gestor del engranaje; vacío si no se pueden elegir (no es el dueño, o manda la campaña). */
  basicOptions: BasicActionOption[];
  /** Fichas y descripciones de las líneas del inventario, para abrir la de cada arma. */
  itemCards: Record<string, ItemDetails>;
  itemDescriptions: Record<string, string>;
  custom: SheetCustom;
  /** Acciones que dan los objetos del inventario. */
  itemActions: ItemAction[];
  /** Sección de maestrías, tras los ataques. */
  mastery?: ReactNode;
};

const SPELL_ICON = iconSrc("action", "cast-spell");
// Icono de la escuela del conjuro (blanco, como los demás); sin él, el genérico
const schoolIcon = (school: string) => iconSrc("darkSchool", school) ?? SPELL_ICON;

// Lo que el filtro oculta en pantalla sigue en el documento y sale al imprimir
const hide = (visible: boolean) => (visible ? "" : "hidden print:block");

// Columnas de los ataques: nombre | alcance | golpe | daño (también en la barra de la sección)
const ATTACK_GRID = "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_9rem]";
const DETAIL_GRID = "grid gap-x-4 gap-y-1 px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]";
const hitClass = "font-heading font-bold text-success";
const damageClass = "flex flex-wrap items-center gap-x-1.5 font-semibold text-brand-soft";

const GROUP_TITLES = { action: "Acciones", bonus: "Acciones adicionales", reaction: "Reacciones", other: "Otras" } as const;
type Group = keyof typeof GROUP_TITLES;

function HitCell({ name, hit }: { name: string; hit: string }) {
  return /^[+-]\d+$/.test(hit)
    ? <RollButton label={`${name}: ataque`} expr={d20Expr(Number(hit))} d20 className={hitClass}>{hit}</RollButton>
    : <span className={`${hitClass} ${hit ? "" : "font-normal text-muted"}`}>{hit || "—"}</span>;
}

function DamageCell({ name, damage, healing = false, children }: { name: string; damage: string; healing?: boolean; children?: ReactNode }) {
  const expr = diceIn(damage);
  return (
    <span className={`${damageClass} ${healing ? "text-success!" : ""}`}>
      {expr ? <RollButton label={`${name}: ${healing ? "curación" : "daño"}`} expr={expr}>{damage}</RollButton> : damage}
      {children}
    </span>
  );
}

// Pestaña Combate: los ataques y, por lo que cuesta usarlos, los conjuros, rasgos y acciones. Todo sale en el documento: el
// filtro y el buscador solo deciden qué se ve en pantalla, la hoja impresa sale completa.
export default function ActionsTab({ characterId, isOwner, active, summary, filter, base, query, entries, spells, basics, basicOptions, itemCards, itemDescriptions, custom, itemActions, mastery }: Props) {
  const sections = actionSections(summary, "todo");
  const features: FeatureInfo[] = sections.flatMap((s) => s.features).map((f) => {
    const e = entries.get(refKey(f.ref));
    // Una especie con varios contadores repite el ref: la clave de cada uno es la de su contador
    return { key: f.uses?.key ?? refKey(f.ref), name: f.name, source: f.source, description: e ? e.descriptionEs || e.description : "" };
  });

  const common = { custom, characterId, isOwner };

  // Ataques: armas, conjuros con tirada y los añadidos a mano
  const attackRows: OrderedRow[] = [
    ...sections.flatMap((s) => s.attacks.map((r): OrderedRow => {
      if (r.kind === "attack") {
        const a = r.attack;
        return {
          key: `attack:${a.lineId ?? a.name}:${a.variant ?? ""}`,
          label: a.name,
          node: (
            <div className={ATTACK_GRID}>
              <div className="col-span-3 min-w-0 sm:col-span-1">
                <span className="flex items-center gap-2 font-semibold text-white">
                  <span className="relative inline-flex shrink-0">
                    <MaskIcon src={iconSrc("weaponType", a.kind)} size={16} label={a.kind === "ranged" ? "A distancia" : "Cuerpo a cuerpo"} className="text-muted" />
                    {a.mastery && <Star size={9} role="img" aria-label={`Maestría: ${a.mastery}`} className="absolute -right-1 -top-1 fill-brand-soft text-brand-soft" />}
                  </span>
                  {a.lineId ? <ItemButton lineId={a.lineId} name={a.name} /> : <span>{a.name}</span>}
                </span>
                <span className="block text-xs text-muted">{[a.kind === "ranged" ? "A distancia" : "Cuerpo a cuerpo", a.notes].filter(Boolean).join(" · ")}</span>
              </div>
              <span className="text-muted">{a.range}</span>
              <HitCell name={a.name} hit={fmtMod(a.bonus)} />
              <DamageCell name={a.name} damage={a.damage}>
                <MaskIcon src={iconSrc("damageType", a.damageTypeId)} size={16} className="text-brand-soft" />
              </DamageCell>
            </div>
          ),
        };
      }
      return {
        key: `spell:${refKey(r.ref)}`,
        label: r.name,
        node: (
          <div className={ATTACK_GRID}>
            <div className="col-span-3 min-w-0 sm:col-span-1">
              <span className="flex items-center gap-2 font-semibold text-white">
                <MaskIcon src={schoolIcon(r.school)} size={16} label="Conjuro" className="text-muted" />
                <SpellLink spellRef={r.ref} name={r.name} />
              </span>
              <span className="block text-xs text-muted">{[r.subtitle, r.notes].filter(Boolean).join(" · ")}</span>
            </div>
            <span className="text-muted">{r.range}</span>
            <HitCell name={r.name} hit={r.hit ?? ""} />
            {r.damage ? (
              <DamageCell name={r.name} damage={r.damage} healing={!!r.healing}>
                {r.healing ? <span className="text-xs font-normal text-success">Curación</span> : (
                  <MaskIcon src={iconSrc("damageType", r.damageTypeId)} size={16} label={r.damageTypeId ? DAMAGE_TYPE_NAMES[r.damageTypeId] : undefined} className="text-brand-soft" />
                )}
              </DamageCell>
            ) : <span className="text-muted">—</span>}
          </div>
        ),
      };
    })),
    ...custom.items.flatMap((c): OrderedRow[] => (c.kind !== "attack" ? [] : [{
      key: `custom:${c.id}`,
      customId: c.id,
      label: c.name,
      node: (
        <div className={ATTACK_GRID}>
          <div className="col-span-3 min-w-0 sm:col-span-1">
            <span className="block font-semibold text-white">{c.name}</span>
            <span className="block text-xs text-muted">{c.notes || "Personalizado"}</span>
          </div>
          <span className="text-muted">{c.range || "—"}</span>
          <HitCell name={c.name} hit={c.hit} />
          {c.damage ? <DamageCell name={c.name} damage={c.damage} /> : <span className="text-muted">—</span>}
        </div>
      ),
    }])),
  ];

  // La fila de las acciones básicas sigue ahí aunque se desactiven todas, para poder volver a activarlas
  const basicsRow = (group: Group, s: ActionSection | undefined): OrderedRow[] => {
    const shownBasics = s?.basics ?? [];
    const options = basicOptions.filter((o) => o.group === group);
    if (shownBasics.length === 0 && options.length === 0) return [];
    const title = group === "reaction" ? "Reacciones en combate" : "Acciones en combate";
    return [{
      key: `basics:${group}`,
      label: "Acciones en combate",
      search: `Acciones en combate ${shownBasics.map((b) => b.name).join(" ")}`,
      node: (
        <div className={DETAIL_GRID}>
          <span className="flex items-center gap-2 font-semibold text-white">
            {title}
            {options.length > 0 && <BasicActionsManager characterId={characterId} title={title} options={options} />}
          </span>
          <p className="text-muted">
            {shownBasics.length === 0 ? "Ninguna activada." : shownBasics.map((b, i) => (
              <Fragment key={refKey(b.ref)}>
                {i > 0 && ", "}
                <BasicActionButton actionKey={refKey(b.ref)} name={b.name} />
              </Fragment>
            ))}
          </p>
        </div>
      ),
    }];
  };

  const groupRows = (group: Group, s: ActionSection | undefined): OrderedRow[] => [
    ...(s?.spells ?? []).map((sp): OrderedRow => ({
      key: `spell:${refKey(sp.ref)}`,
      label: sp.name,
      node: (
        <div className={DETAIL_GRID}>
          <span className="flex min-w-0 items-center gap-2 font-semibold text-white">
            <MaskIcon src={schoolIcon(sp.school)} size={16} label="Conjuro" className="text-muted" />
            <SpellLink spellRef={sp.ref} name={sp.name} />
          </span>
          <span className="text-muted">{[sp.subtitle, sp.range, sp.notes].filter(Boolean).join(" · ")}</span>
        </div>
      ),
    })),
    ...(s?.features ?? []).map((f): OrderedRow => {
      const e = entries.get(refKey(f.ref));
      return {
        key: `feature:${f.uses?.key ?? refKey(f.ref)}`,
        label: f.name,
        node: (
          <div className={DETAIL_GRID}>
            <div className="min-w-0">
              <FeatureButton featureKey={f.uses?.key ?? refKey(f.ref)} name={f.name} />
              {e && !e.nameEs && <UntranslatedTag className="ml-2" />}
              {f.special && <span className="ml-2 text-muted">(Especial)</span>}
              <span className="block text-xs text-brand-soft">{f.source}</span>
              {f.uses && <FeatureUsesControl characterId={characterId} use={f.uses} isOwner={isOwner} className="mt-1.5" />}
            </div>
            <p className="line-clamp-2 min-w-0 text-muted print:hidden">{e ? plainText(e.descriptionEs || e.description) : ""}</p>
          </div>
        ),
      };
    }),
    ...basicsRow(group, s),
    ...itemActions.filter((a) => a.group === group).map((a): OrderedRow => ({
      key: a.key,
      label: a.name,
      node: (
        <div className={DETAIL_GRID}>
          <span className="min-w-0">
            <ItemButton lineId={a.lineId} name={a.name} />
            {a.healing && (
              <span className="mt-0.5 block font-heading font-bold text-success">
                <RollButton label={`${a.name}: curación`} expr={a.healing}>{a.healing}</RollButton>
              </span>
            )}
          </span>
          <p className="line-clamp-3 min-w-0 text-muted print:line-clamp-none">{a.details}</p>
        </div>
      ),
    })),
    ...custom.items.flatMap((c): OrderedRow[] => (c.kind !== "action" || c.group !== group ? [] : [{
      key: `custom:${c.id}`,
      customId: c.id,
      label: c.name,
      node: (
        <div className={DETAIL_GRID}>
          <span className="font-semibold text-white">{c.name}</span>
          <p className="min-w-0 whitespace-pre-wrap text-muted">{c.details}</p>
        </div>
      ),
    }])),
  ];

  // Un grupo se ve con «Todo» o con su filtro; con «Ataques», solo la sección de ataques
  const groupVisible = (g: Group) => filter === "todo" || filter === g;
  const anyAttacksShown = filter === "todo" || filter === "ataques"
    || sections.some((s) => s.group === filter && sectionVisibility(s, filter).attacks);
  return (
    <ActionsDialogs characterId={characterId} active={active} spells={spells} basics={basics} features={features} itemCards={itemCards} itemDescriptions={itemDescriptions}>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
        <PanelSearch label="Buscar en combate" />
        <ShowSelect
          label="Mostrar en combate"
          value={filter}
          options={ACTION_FILTERS.map((f) => ({ id: f.id, label: f.label, href: `${base}${actionFilterHref(query, f.id)}` }))}
        />
      </div>
      <div className="space-y-5">
        <OrderedSection
          {...common}
          id="combate:ataques"
          title="Ataques"
          className={`animate-fade-up ${hide(anyAttacksShown)}`}
          extra={<>Por acción: <span className="font-heading font-bold text-fg">{summary.attacksPerAction}</span></>}
          columns={(
            <span className="hidden gap-3 sm:flex">
              <span className="w-[6.5rem]">Alcance</span><span className="w-[5.5rem]">Golpe/CD</span><span className="w-[9rem]">Daño</span>
            </span>
          )}
          rows={attackRows}
          add={{ kind: "attack" }}
          empty="Sin ataques."
        />
        {mastery}
        {(Object.keys(GROUP_TITLES) as Group[]).map((g) => (
          <OrderedSection
            {...common}
            key={g}
            id={`combate:${g}`}
            title={GROUP_TITLES[g]}
            className={`animate-fade-up ${hide(groupVisible(g))}`}
            columns={<span className="hidden sm:inline">Detalles</span>}
            rows={groupRows(g, sections.find((s) => s.group === g))}
            add={{ kind: "action", group: g }}
            empty={`Sin ${GROUP_TITLES[g].toLowerCase()}.`}
          />
        ))}
      </div>
    </ActionsDialogs>
  );
}
