import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { TriangleAlert } from "lucide-react";
import { connectDB } from "@/lib/mongodb";
import { Campaign } from "@/lib/Campaign";
import { requireUser } from "@/lib/currentUser";
import { loadCharacterFor } from "@/lib/characterAccess";
import { booksByIds } from "@/lib/rules/books";
import { derive } from "@/lib/rules/dnd2024/derive";
import { refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import type { BackgroundData, ItemData } from "@/lib/rules/types";
import SheetHeader from "@/app/components/characters/sheet/SheetHeader";
import SheetTabs, { isSheetTab, SHEET_TABS, type SheetTab } from "@/app/components/characters/sheet/SheetTabs";
import InfoTab from "@/app/components/characters/sheet/InfoTab";
import BackgroundTab from "@/app/components/characters/sheet/BackgroundTab";
import FeaturesTab from "@/app/components/characters/sheet/FeaturesTab";
import EquipmentTab, { type ItemInfo } from "@/app/components/characters/sheet/EquipmentTab";
import type { CharacterStatus } from "@/app/components/characters/sheet/StatusBadge";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Pestañas disponibles: Conjuros llega con la parte 5
const TABS: SheetTab[] = ["info", "trasfondo", "rasgos", "equipo"];

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

  const isOwner = String(c.owner) === user.id;
  const tab: SheetTab = isSheetTab(query.tab) && TABS.includes(query.tab) ? query.tab : "info";

  let campaign: { id: string; name: string } | null = null;
  if (c.campaign) {
    await connectDB();
    const doc = await Campaign.findById(c.campaign).select("name").lean();
    if (doc) campaign = { id: String(doc._id), name: doc.name };
  }

  const species = `${sheet.species.name}${sheet.lineage ? ` (${sheet.lineage.name})` : ""}`;
  const classes = d.classes.map((k) => `${k.name} ${k.level}`).join(" / ");
  const background = entries.get(refKey(sheet.background.ref)) ?? null;
  const featRef = (background?.data as BackgroundData | undefined)?.feat;
  const feat = featRef ? (entries.get(refKey(featRef)) ?? null) : null;

  // Atribución del SRD si se usa contenido de un libro con esa licencia
  const usedBooks = [...new Set([...entries.values()].map((e) => e.ref.book))];
  const attributions = [...new Set((await booksByIds(usedBooks)).filter((b) => b.license === "srd" && b.attribution).map((b) => b.attribution))];

  // Datos del catálogo de cada línea del inventario: peso y si se puede equipar (armadura, escudo o arma)
  const itemInfo: Record<string, ItemInfo> = {};
  for (const line of sheet.inventory.items) {
    const data = line.ref ? (entries.get(refKey(line.ref))?.data as ItemData | undefined) : undefined;
    itemInfo[line.id] = { weight: data?.weight ?? 0, equippable: !!(data?.armor || data?.weapon) };
  }

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
    <div className="mx-auto max-w-280 px-4 py-8 sm:px-5">
      <SheetHeader
        id={id}
        name={c.name}
        portraitUrl={c.portraitId ? `/api/images/${c.portraitId}` : null}
        status={(c.status ?? "active") as CharacterStatus}
        summary={[species, classes].filter(Boolean).join(" ")}
        level={d.level}
        campaign={campaign}
        isOwner={isOwner}
        notice={query.saved ? "Cambios guardados" : null}
        backHref={isOwner || !campaign ? "/characters" : `/campaigns/${campaign.id}/characters`}
      />

      {d.missing.length > 0 && (
        <p role="status" className="mb-6 flex items-start gap-2 rounded-md border border-line bg-surface p-3 text-sm text-muted">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-brand-soft" aria-hidden="true" />
          <span>Contenido no disponible: {d.missing.join(", ")}. Se muestra el nombre guardado.</span>
        </p>
      )}

      <SheetTabs base={base} active={tab} tabs={TABS} />

      <section {...panel("info")}>
        {panelTitle("info")}
        <InfoTab d={d} characterId={id} isOwner={isOwner} />
      </section>
      <section {...panel("trasfondo")}>
        {panelTitle("trasfondo")}
        <BackgroundTab
          sheet={sheet}
          backstory={c.backstory ?? ""}
          imageUrl={c.imageId ? `/api/images/${c.imageId}` : null}
          background={background}
          feat={feat}
        />
      </section>
      <section {...panel("rasgos")}>
        {panelTitle("rasgos")}
        <FeaturesTab groups={d.features} entries={entries} />
      </section>
      <section {...panel("equipo")}>
        {panelTitle("equipo")}
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

      {attributions.map((a) => (
        <p key={a} className="mt-6 text-xs text-muted">{a}</p>
      ))}
    </div>
  );
}
