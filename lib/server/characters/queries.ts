import "server-only";
// Datos de las páginas de personajes: «Mis personajes», el creador, la ficha y «Rehacer creación».
import { connectDB } from "@/lib/models/mongodb";
import { Campaign } from "@/lib/models/Campaign";
import { Character } from "@/lib/models/Character";
import { joinReasons } from "@/lib/server/campaigns/campaignEligibility";
import { visibleBooksOf } from "@/lib/server/catalog/books";
import { NotFoundError, listEntries, listChoiceItems, listMasteryWeapons, usableBooks, type EntryOption } from "@/lib/server/catalog/catalog";
import type { loadCharacterFor } from "@/lib/server/characters/characterAccess";
import { isValidId } from "@/lib/server/ids";
import { system as rpgSystems } from "@/lib/utils/systems";
import { accentInsensitive } from "@/lib/utils/utils";
import { classesOf } from "@/lib/rules/dnd2024/sheet/upgrade";
import type { SpeciesData } from "@/lib/rules/types";

type LoadedCharacter = NonNullable<Awaited<ReturnType<typeof loadCharacterFor>>>["character"];

export type CharacterFilters = {
  q: string;
  status: "active" | "retired" | "dead" | "npc" | "all";
  sort: "recent" | "name";
};

/* «Mis personajes»: las tarjetas de los personajes del usuario con los filtros (la búsqueda mira el nombre, la
   especie, el legado, la clase y el nombre de la campaña), las campañas activas que admiten crear personajes desde
   ellas y los libros que ve el usuario (para el diálogo de «Nuevo personaje»). */
export async function listMyCharacters(userId: string, { q, status, sort }: CharacterFilters) {
  await connectDB();

  // Campañas del usuario: alimentan el diálogo y los enlaces de las tarjetas
  const myCampaigns = await Campaign.find({ members: userId, status: "active" })
    .select("name systemId restrictBooks characters")
    .sort({ name: 1 })
    .collation({ locale: "es", strength: 2 })
    .lean();

  const filter: Record<string, unknown> = { owner: userId };
  if (status !== "all") filter.status = status;
  if (q) {
    const rx = { $regex: accentInsensitive(q), $options: "i" }; // sin distinguir tildes ni mayúsculas
    // Para buscar por campaña se averiguan antes los ids por nombre (también las que ya no están activas)
    const named = await Campaign.find({ members: userId, name: rx }).select("_id").lean();
    filter.$or = [
      { name: rx },
      { "sheet.species.name": rx },
      { "sheet.lineage.name": rx },
      { "sheet.classesSummary.class.name": rx },
      { "sheet.classes.name": rx }, // hojas v1 aún sin migrar
      { campaign: { $in: named.map((c) => c._id) } },
    ];
  }

  const [characters, books] = await Promise.all([
    Character.find(filter)
      .select("name systemId status campaign campaignStatus portraitId sheet.species sheet.lineage sheet.classes sheet.classesSummary")
      .sort(sort === "name" ? { name: 1 } : { updatedAt: -1 })
      .collation({ locale: "es", strength: 2 })
      .limit(100)
      .lean(),
    visibleBooksOf(userId),
  ]);

  // Nombres de las campañas de las tarjetas (alguna puede que ya no esté activa)
  const campaignNames = new Map<string, string>(myCampaigns.map((c) => [String(c._id), c.name as string]));
  const missing = [...new Set(characters.flatMap((c) => (c.campaign ? [String(c.campaign)] : [])))].filter(
    (id) => !campaignNames.has(id),
  );
  if (missing.length > 0) {
    const extra = await Campaign.find({ _id: { $in: missing } }).select("name").lean();
    for (const c of extra) campaignNames.set(String(c._id), c.name);
  }

  const cards = characters.map((c) => {
    const s = c.sheet ?? {};
    const cls = classesOf(s)[0];
    const species = s.species?.name ? `${s.species.name}${s.lineage?.name ? ` (${s.lineage.name})` : ""}` : "";
    const klass = cls?.class?.name ? `${cls.class.name}${cls.level ? ` ${cls.level}` : ""}` : "";
    const campaignId = c.campaign ? String(c.campaign) : "";
    const campaignName = campaignNames.get(campaignId);
    return {
      id: String(c._id),
      name: c.name,
      portraitUrl: c.portraitId ? `/api/images/${c.portraitId}` : null,
      summary: [species, klass].filter(Boolean).join(" · "),
      systemName: rpgSystems.find((r) => r.id === c.systemId)?.name ?? c.systemId,
      status: c.status,
      campaign: campaignName ? { id: campaignId, name: campaignName } : null,
      pending: c.campaignStatus === "pending",
    };
  });

  const dialogCampaigns = myCampaigns
    .filter((c) => c.characters?.allowed === true && c.characters?.internal === true)
    .map((c) => ({
      id: String(c._id),
      name: c.name as string,
      systemId: c.systemId as string,
      restrictBooks: !!c.restrictBooks,
    }));

  return { cards, dialogCampaigns, books };
}

/* Listas del creador con los libros dados: especies (con los legados de cada una que los tiene, del mismo libro, por
   "libro:clave" de la especie), clases, trasfondos, y dotes, rasgos opcionales y armas con maestría para las
   elecciones de nivel 1 de la clase, y los idiomas y los objetos a elegir del equipo inicial. Las listas de conjuros las pide el creador al elegir la clase. */
export async function loadCreatorLists(books: string[]) {
  const [species, classes, backgrounds, feats, optionalFeatures, weapons, languages, choiceItems] = await Promise.all([
    listEntries({ books, kind: "species" }),
    listEntries({ books, kind: "class" }),
    listEntries({ books, kind: "background" }),
    listEntries({ books, kind: "feat" }),
    listEntries({ books, kind: "optionalFeature" }),
    listMasteryWeapons(books),
    listEntries({ books, kind: "language" }),
    listChoiceItems(books),
  ]);
  const lineages: Record<string, EntryOption[]> = {};
  await Promise.all(
    species
      .filter((s) => (s.data as SpeciesData | null)?.hasLineages)
      .map(async (s) => {
        const list = await listEntries({ books, kind: "lineage", parent: s.ref.key });
        lineages[`${s.ref.book}:${s.ref.key}`] = list.filter((l) => l.ref.book === s.ref.book);
      }),
  );
  return { species, lineages, classes, backgrounds, feats, optionalFeatures, weapons, languages, choiceItems };
}

/* El creador de un personaje nuevo. Con campaña, tiene que ser del mismo sistema y admitir personajes internos, y
   quien crea tiene que ser miembro. null = 404 (también si la campaña o los libros no son válidos). */
export async function loadCreatorPage(
  userId: string,
  { systemId, campaignId, chosenBooks }: { systemId: string; campaignId: string; chosenBooks: string[] },
) {
  let campaign: { id: string; name: string } | null = null;
  if (campaignId) {
    if (!isValidId(campaignId)) return null;
    await connectDB();
    const doc = await Campaign.findOne({ _id: campaignId, members: userId })
      .select("name systemId characters")
      .lean();
    if (!doc || doc.systemId !== systemId || !(doc.characters?.allowed === true && doc.characters?.internal === true)) return null;
    campaign = { id: campaignId, name: doc.name };
  }

  let books: string[];
  try {
    books = await usableBooks({ userId, systemId, campaignId: campaignId || undefined, chosenBooks });
  } catch (e) {
    if (e instanceof NotFoundError) return null;
    throw e;
  }

  return { campaign, lists: await loadCreatorLists(books) };
}

/* Campaña de la cabecera de la ficha: la del personaje (si está pendiente y si quien mira es su DM) o, si no tiene y
   quien mira es su dueño, las campañas activas del dueño de este sistema a las que podría unirlo, cada una con su
   elegibilidad. */
export async function loadSheetCampaign(userId: string, character: LoadedCharacter, isOwner: boolean) {
  let campaign: { id: string; name: string; pending: boolean; isDm: boolean } | null = null;
  let joinable: { id: string; name: string; isDm: boolean; reason: string | null }[] = [];
  await connectDB();
  if (character.campaign) {
    const doc = await Campaign.findById(character.campaign).select("name owner").lean();
    if (doc) {
      campaign = {
        id: String(doc._id),
        name: doc.name,
        pending: character.campaignStatus === "pending",
        isDm: String(doc.owner) === userId,
      };
    }
  } else if (isOwner) {
    const mine = await Campaign.find({ members: userId, status: "active", systemId: character.systemId })
      .select("name owner members systemId status characters restrictBooks allowedBooks")
      .sort({ name: 1 })
      .collation({ locale: "es", strength: 2 })
      .lean();
    const reasons = await joinReasons(
      userId,
      mine.map((m) => ({ campaign: m, character: { systemId: character.systemId, sheet: character.sheet } })),
    );
    joinable = mine.map((m, i) => ({ id: String(m._id), name: m.name, isDm: String(m.owner) === userId, reason: reasons[i] }));
  }
  return { campaign, joinable };
}

// Id y nombre de la campaña de un personaje, o null si no tiene (o ya no existe)
export async function campaignRefOf(character: LoadedCharacter) {
  const doc = character.campaign ? await Campaign.findById(character.campaign).select("name").lean() : null;
  return doc ? { id: String(character.campaign), name: doc.name as string } : null;
}
