import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/server/auth/currentUser";
import { loadCharacterFor } from "@/lib/server/characters/characterAccess";
import { loadSheetCampaign } from "@/lib/server/characters/queries";
import { system as rpgSystems } from "@/lib/utils/systems";
import { booksByIds } from "@/lib/server/catalog/books";
import { listActions, listMasteryWeapons, listSpells } from "@/lib/server/catalog/catalog";
import { derive } from "@/lib/rules/dnd2024/derive";
import { deriveActions, withSpellEntries } from "@/lib/rules/dnd2024/derive/actions";
import { ACTION_TIME_LABELS, parseActionFilter } from "@/lib/rules/dnd2024/sheet/actionFilters";
import { actionIcon } from "@/lib/rules/dnd2024/sheet/actionIcons";
import { weaponProficient } from "@/lib/rules/dnd2024/derive/attacks";
import { normalizeSheetTab } from "@/lib/rules/dnd2024/sheet/sheetTabs";
import { bareName, refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import {
  currentMasteries, isMasteryWeapon, masteryCount, masteryLabel, masteryMeleeOnly,
} from "@/lib/rules/dnd2024/levels/masteries";
import { parsePronouns, pronounsText } from "@/lib/rules/dnd2024/creation/names";
import { spellListOf } from "@/lib/rules/dnd2024/spells/spellcasting";
import { spellTableRows } from "@/lib/rules/dnd2024/spells/spellTable";
import { hitDicePools } from "@/lib/rules/dnd2024/sheet/rest";
import { statusOf } from "@/lib/rules/dnd2024/sheet/status";
import { shortRestRestores } from "@/lib/rules/dnd2024/spells/spellOps";
import { sizeName } from "@/lib/rules/dnd2024/sheet/labels";
import type { ActionData, BackgroundData, ItemData, SpeciesData } from "@/lib/rules/types";
import SheetHeader from "@/app/components/characters/sheet/SheetHeader";
import type { JoinableCampaign } from "@/app/components/characters/sheet/JoinCampaignDialog";
import SheetTabs, { SHEET_TABS, type SheetTab } from "@/app/components/characters/sheet/SheetTabs";
import SheetLayout, { type SheetData } from "@/app/components/characters/sheet/SheetLayout";
import ActionsTab from "@/app/components/characters/sheet/ActionsTab";
import type { BasicActionInfo } from "@/app/components/characters/sheet/ActionsDialogs";
import BackgroundTab from "@/app/components/characters/sheet/BackgroundTab";
import NotesTab from "@/app/components/characters/sheet/NotesTab";
import FeaturesTab from "@/app/components/characters/sheet/FeaturesTab";
import EquipmentTab, { type ItemInfo } from "@/app/components/characters/sheet/EquipmentTab";
import MasteriesEditor from "@/app/components/characters/sheet/MasteriesEditor";
import SpellsTab from "@/app/components/characters/spells/SpellsTab";
import type { CharacterStatus } from "@/app/components/characters/sheet/StatusBadge";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Pestañas de todas las fichas; Conjuros, solo si el personaje tiene conjuros
const BASE_TABS: SheetTab[] = ["acciones", "inventario", "rasgos", "trasfondo"];

// Avisos al volver de una acción (`?saved=…`)
const NOTICES: Record<string, string> = {
  level: "Nivel guardado correctamente",
  "level-deleted": "Nivel borrado",
  creation: "Creación rehecha correctamente",
};

// Lectura compartida entre generateMetadata y la página (una sola carga por petición)
const loadForRead = cache((userId: string, id: string) => loadCharacterFor(userId, id, "read"));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser(`/characters/${id}`);
  const found = await loadForRead(user.id, id);
  return { title: found?.character.name ?? "Personaje" };
}

export default async function CharacterPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser(`/characters/${id}`);
  const found = await loadForRead(user.id, id);
  if (!found) notFound();
  const { character: c, sheet, entries } = found;
  const d = derive(sheet, entries);

  const pools = hitDicePools(sheet, entries);
  const isOwner = String(c.owner) === user.id;
  // Notas: siempre para el dueño; para los demás, solo si alguna tiene texto
  const hasNotes = [sheet.organizations, sheet.allies, sheet.enemies, sheet.notes].some((n) => n?.trim());
  const withNotes: SheetTab[] = isOwner || hasNotes ? ["notas"] : [];
  const tabs: SheetTab[] = [
    ...(d.hasSpells ? (["acciones", "conjuros", "inventario", "rasgos", "trasfondo"] as SheetTab[]) : BASE_TABS),
    ...withNotes,
  ];
  const tab = normalizeSheetTab(query.tab, tabs);

  // Su campaña o, si no tiene y eres su dueño, las campañas a las que puedes unirlo («Unir a una campaña»)
  const sheetCampaign = await loadSheetCampaign(user.id, c, isOwner);
  const { campaign } = sheetCampaign;
  const joinable: JoinableCampaign[] = sheetCampaign.joinable;

  const species = `${sheet.species.name}${sheet.lineage ? ` (${sheet.lineage.name})` : ""}`;
  const classes = d.classes.map((k) => `${k.name} ${k.level}`).join(" / ");
  const background = entries.get(refKey(sheet.background.ref)) ?? null;
  const featRef = (background?.data as BackgroundData | undefined)?.feat;
  const feat = featRef ? (entries.get(refKey(featRef)) ?? null) : null;

  // Tamaño: el elegido o, si la especie solo tiene uno, ese
  const speciesSizes = (entries.get(refKey(sheet.species.ref))?.data as SpeciesData | undefined)?.size ?? [];
  const sizeId = sheet.speciesChoices.size ?? (speciesSizes.length === 1 ? speciesSizes[0] : null);
  const size = sizeId ? sizeName(sizeId) : "—";

  // Atribución del SRD si se usa contenido de un libro con esa licencia
  const usedBooks = [...new Set([...entries.values()].map((e) => e.ref.book))];
  const attributions = [...new Set((await booksByIds(usedBooks)).filter((b) => b.license === "srd" && b.attribution).map((b) => b.attribution))];

  // Datos del catálogo de cada línea del inventario: peso y si se puede equipar (armadura, escudo o arma)
  const itemInfo: Record<string, ItemInfo> = {};
  for (const line of sheet.inventory.items) {
    const data = line.ref ? (entries.get(refKey(line.ref))?.data as ItemData | undefined) : undefined;
    itemInfo[line.id] = { weight: data?.weight ?? 0, equippable: !!(data?.armor || data?.weapon || data?.defenses) };
  }

  // Maestrías con armas: las actuales y, para cambiarlas, las armas con maestría y competencia (del Bárbaro, solo
  // cuerpo a cuerpo)
  const allowedMasteries = masteryCount(sheet, entries);
  const masteryRefs = currentMasteries(sheet);
  const masteryWeapons = allowedMasteries > 0 || masteryRefs.length > 0 ? await listMasteryWeapons(found.books) : [];
  const weaponLabel = (w: (typeof masteryWeapons)[number]) =>
    masteryLabel(w.nameEs ?? w.name, (w.data as ItemData | null)?.weapon?.mastery);
  const masteryOptions = masteryWeapons
    .filter((w) => isMasteryWeapon(w.data as ItemData, masteryMeleeOnly(sheet, entries))
      && weaponProficient(w.data as ItemData, [w.name, bareName(w.ref.key)], d.weapons))
    .map((w) => ({ id: refKey(w.ref), label: weaponLabel(w) }));
  const masteryCurrent = masteryRefs.map((r) => {
    const w = masteryWeapons.find((x) => refKey(x.ref) === refKey(r));
    return { id: refKey(r), label: w ? weaponLabel(w) : bareName(r.key) };
  });

  // Conjuros: los que ya tiene el personaje (en todas las pestañas: se imprimen) y, solo con la pestaña Conjuros abierta,
  // la lista de cada clase lanzadora, sin descripción; se filtra en el navegador. Cada pestaña es una navegación
  // (`?tab=`), así que al abrir la de Conjuros la página vuelve con las listas
  const spellLists = Object.fromEntries(d.spells.blocks.map((b) => {
    const identifier = entries.get(refKey(b.class))?.identifier || undefined;
    return [refKey(b.class), { listId: spellListOf(b.class, identifier), iconId: identifier ?? bareName(b.class.key) }];
  }));
  // (con Secretos mágicos, también sus otras listas)
  const listIds = new Set([...Object.values(spellLists).map((l) => l.listId), ...d.spells.blocks.flatMap((b) => b.lists ?? [])]);
  const ownSpells = new Set([
    ...d.spells.blocks.flatMap((b) => [
      ...[...b.cantrips, ...b.known, ...b.spellbook].map((s) => refKey(s.ref)),
      ...b.prepared.map(refKey),
      ...b.always.map((a) => refKey(a.spell.ref)),
      ...b.limited.map((l) => refKey(l.spell.ref)),
    ]),
    ...d.spells.other.map((o) => refKey(o.spell.ref)),
  ]);
  const withLists = tab === "conjuros";
  const spellOptions = d.hasSpells
    ? (await listSpells(found.books))
      .filter((s) => ownSpells.has(refKey(s.ref)) || (withLists && s.data.classes.some((c) => listIds.has(c))))
    : [];

  // Acciones (spec de acciones §3-4): armas, conjuros utilizables, rasgos con activación y las acciones básicas de los
  // libros del personaje; el filtro va en `?filtro=`
  const basicEntries = await listActions(found.books);
  // (los conjuros no están en `entries`: se toman del listado de la pestaña Conjuros)
  const spellEntries = withSpellEntries(entries, spellOptions);
  const actions = deriveActions({
    attacks: d.attacks, spells: d.spells, features: d.features, basics: basicEntries, entries: spellEntries,
  });
  const actionFilter = parseActionFilter(query.filtro);
  const actionSpellKeys = new Set(actions.items.flatMap((i) => (i.kind === "spell" ? [refKey(i.ref)] : [])));
  const actionSpells = spellOptions.filter((s) => actionSpellKeys.has(refKey(s.ref)));
  const basics: BasicActionInfo[] = basicEntries.map((e) => ({
    key: refKey(e.ref),
    name: e.nameEs ?? e.name,
    icon: actionIcon(e.ref.key),
    time: ACTION_TIME_LABELS[(e.data as ActionData).time] ?? "",
    description: e.descriptionEs || e.description,
  }));

  // Franja superior y cajas de la ficha: solo los valores que muestran (son componentes de cliente)
  const sheetData: SheetData = {
    abilities: d.abilities, proficiencyBonus: d.proficiencyBonus, hp: d.hp, ac: d.ac, armorWarning: d.armorWarning,
    initiative: d.initiative, speed: d.speed, darkvision: d.darkvision, saves: d.saves, skills: d.skills, armor: d.armor,
    weapons: d.weapons, tools: d.tools, languages: d.languages, breakdowns: d.breakdowns, defenses: d.defenses,
  };

  const base = `/characters/${id}`;
  // Las pestañas inactivas se ocultan en pantalla, pero se imprimen todas seguidas
  const panel = (t: SheetTab) => ({
    id: `panel-${t}`,
    className: t === tab ? "" : "hidden print:block",
  });
  const panelTitle = (t: SheetTab) => (
    <h2 className="sr-only print:not-sr-only print:mb-4 print:mt-8 print:font-heading print:text-2xl print:font-bold">
      {SHEET_TABS.find((x) => x.id === t)?.label}
    </h2>
  );

  return (
    <div className="mx-auto max-w-280 px-4 py-8 sm:px-5 xl:max-w-360">
      {/* Con otro aviso (p. ej. tras borrar un nivel desde la propia ficha) la cabecera se monta de nuevo para mostrarlo */}
      <SheetHeader
        key={String(query.saved ?? "")}
        id={id}
        name={c.name}
        pronouns={pronounsText(parsePronouns(((c.pronouns ?? []) as string[]).join(",")) ?? [])}
        portraitUrl={c.portraitId ? `/api/images/${c.portraitId}` : null}
        status={(c.status ?? "active") as CharacterStatus}
        summary={[species, classes].filter(Boolean).join(" ")}
        level={d.level}
        campaign={campaign}
        isOwner={isOwner}
        pools={pools}
        conMod={d.abilities.con.mod}
        recoversOther={shortRestRestores(d.spells)}
        joinable={joinable}
        systemName={rpgSystems.find((r) => r.id === c.systemId)?.name ?? c.systemId}
        notice={query.saved ? (NOTICES[String(query.saved)] ?? "Cambios guardados") : null}
        backHref={isOwner || !campaign ? "/characters" : `/campaigns/${campaign.id}/characters`}
      />

      {d.missing.length > 0 && (
        <p role="status" className="mb-6 flex items-start gap-2 rounded-md border border-line bg-surface p-3 text-sm text-muted">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-brand-soft" aria-hidden="true" />
          <span>Contenido no disponible: {d.missing.join(", ")}. Se muestra el nombre guardado.</span>
        </p>
      )}

      {/* Franja superior, cajas y panel de pestañas (spec §4); el editor de PG se monta de nuevo cuando cambian los PG
          (descansos, borrar un nivel) */}
      <SheetLayout
        d={sheetData}
        characterId={id}
        isOwner={isOwner}
        pools={pools}
        status={statusOf(sheet)}
        version={new Date(c.updatedAt ?? 0).getTime()}
        tabs={<SheetTabs base={base} active={tab} tabs={tabs} />}
      >
        <section {...panel("acciones")}>
          {panelTitle("acciones")}
          <ActionsTab
            characterId={id}
            active={tab === "acciones"}
            summary={actions}
            filter={actionFilter}
            base={base}
            query={query}
            entries={entries}
            spells={actionSpells}
            basics={basics}
          />
        </section>
        <section {...panel("trasfondo")}>
          {panelTitle("trasfondo")}
          <BackgroundTab
            characterId={id}
            isOwner={isOwner}
            size={size}
            base={base}
            query={query}
            sheet={sheet}
            backstory={c.backstory ?? ""}
            imageUrl={c.imageId ? `/api/images/${c.imageId}` : null}
            background={background}
            feat={feat}
          />
        </section>
        {withNotes.length > 0 && (
          <section {...panel("notas")}>
            {panelTitle("notas")}
            <NotesTab characterId={id} isOwner={isOwner} sheet={sheet} />
          </section>
        )}
        <section {...panel("rasgos")}>
          {panelTitle("rasgos")}
          <MasteriesEditor
            key={d.level}
            characterId={id}
            isOwner={isOwner}
            allowed={allowedMasteries}
            current={masteryCurrent}
            options={masteryOptions}
          />
          <FeaturesTab groups={d.features} entries={entries} base={base} query={query} />
        </section>
        <section {...panel("inventario")}>
          {panelTitle("inventario")}
          <EquipmentTab
            characterId={id}
            isOwner={isOwner}
            inventory={sheet.inventory}
            info={itemInfo}
            capacity={d.weight.capacity}
            armorWarning={d.armorWarning}
            systemId={c.systemId as string}
            books={found.books}
          />
        </section>

        {d.hasSpells && (
          <section {...panel("conjuros")}>
            {panelTitle("conjuros")}
            {/* Al borrar un nivel desde la ficha se monta de nuevo con los conjuros recortados */}
            <SpellsTab
              key={d.level}
              characterId={id}
              isOwner={isOwner}
              initial={d.spells}
              lists={spellLists}
              spells={spellOptions}
              rows={spellTableRows(d.spells, spellEntries)}
              query={query}
              proficiencyBonus={d.proficiencyBonus}
            />
          </section>
        )}
      </SheetLayout>

      {attributions.map((a) => (
        <p key={a} className="mt-6 text-xs text-muted">{a}</p>
      ))}
    </div>
  );
}
