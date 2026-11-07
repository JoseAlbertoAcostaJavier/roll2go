import "server-only";
// Datos de las páginas de campañas. Las de una campaña reciben lo que da getCampaignAccess (que ya ha comprobado que
// quien mira es miembro): la campaña y si es el DM.
import { connectDB } from "@/lib/models/mongodb";
import { Campaign } from "@/lib/models/Campaign";
import { CampaignInvite } from "@/lib/models/CampaignInvite";
import { CampaignLogEntry } from "@/lib/models/CampaignLogEntry";
import { Character } from "@/lib/models/Character";
import { loadUserCards } from "@/lib/server/account/userCards";
import type { getCampaignAccess } from "@/lib/server/campaigns/campaignAccess";
import { joinReasons } from "@/lib/server/campaigns/campaignEligibility";
import { booksByIds, visibleBooksOf } from "@/lib/server/catalog/books";
import { isValidId } from "@/lib/server/ids";
import { blockedIdsOf } from "@/lib/server/social/blocks";
import { friendIdsOf } from "@/lib/server/social/friends";
import { system as rpgSystems } from "@/lib/utils/systems";
import { escapeRegex } from "@/lib/utils/utils";
import { classesOf } from "@/lib/rules/dnd2024/sheet/upgrade";

type AccessCampaign = Awaited<ReturnType<typeof getCampaignAccess>>["campaign"];

export type CampaignFilters = {
  q: string;
  owner: "all" | "mine" | "others";
  status: "active" | "inactive" | "all";
  sort: "recent" | "new" | "name";
  limit?: number; // por defecto 100; la portada pide solo las últimas
};

// «Mis campañas»: siempre solo las campañas de las que el usuario es miembro, y las invitaciones que le han enviado
export async function listMyCampaigns(userId: string, { q, owner, status, sort, limit = 100 }: CampaignFilters) {
  await connectDB();

  const filter: Record<string, unknown> = { members: userId };
  if (owner === "mine") filter.owner = userId;
  if (owner === "others") filter.owner = { $ne: userId };
  if (status !== "all") filter.status = status;
  if (q) filter.name = { $regex: escapeRegex(q), $options: "i" };

  const sortBy: Record<string, 1 | -1> =
    sort === "name" ? { name: 1 } : sort === "new" ? { createdAt: -1 } : { updatedAt: -1 };

  // Campañas e invitaciones pendientes que te han enviado, a la vez
  const [campaigns, invites] = await Promise.all([
    Campaign.find(filter)
      .select("name systemId status owner members imageId logoId shortDescription")
      .sort(sortBy)
      .collation({ locale: "es", strength: 2 }) // ordena por nombre sin distinguir mayúsculas ni tildes
      .limit(limit)
      .lean(),
    CampaignInvite.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  // DM de cada campaña, campañas de las invitaciones y quién invita
  const [ownerCards, inviteCampaigns, inviterCards] = await Promise.all([
    loadUserCards(campaigns.map((c) => c.owner)),
    Campaign.find({ _id: { $in: invites.map((i) => i.campaign) } }).select("name systemId").lean(),
    loadUserCards(invites.map((i) => i.invitedBy)),
  ]);
  const inviteCampaignById = new Map(inviteCampaigns.map((c) => [String(c._id), c] as const));
  const inviteData = invites.flatMap((i) => {
    const c = inviteCampaignById.get(String(i.campaign));
    if (!c) return [];
    const inviter = inviterCards.get(String(i.invitedBy));
    return [{
      id: String(i._id),
      campaignName: c.name,
      systemName: rpgSystems.find((s) => s.id === c.systemId)?.name ?? c.systemId,
      inviter: inviter ? { displayName: inviter.displayName, avatarUrl: inviter.avatarUrl } : null,
    }];
  });

  return { campaigns, ownerCards, invites: inviteData };
}

// Lo que muestra la tarjeta de una campaña de «Mis campañas» (también la portada)
export function campaignCardOf(
  c: Awaited<ReturnType<typeof listMyCampaigns>>["campaigns"][number],
  userId: string,
) {
  return {
    id: String(c._id),
    name: c.name,
    systemName: rpgSystems.find((r) => r.id === c.systemId)?.name ?? c.systemId,
    status: c.status as string,
    imageId: c.imageId ? String(c.imageId) : null,
    logoId: c.logoId ? String(c.logoId) : null,
    shortDescription: c.shortDescription ?? "",
    players: Math.max(0, (c.members?.length ?? 1) - 1), // sin contar al DM
    mine: String(c.owner) === userId,
  };
}

// Detalles de una campaña: participantes (el DM primero), libros permitidos y, solo para el DM, sus notas privadas
export async function campaignOverview(campaign: AccessCampaign, isDm: boolean) {
  // Las notas privadas solo se cargan de la base de datos si eres el DM
  const notes = isDm
    ? ((await Campaign.findById(campaign._id).select("+privateNotes").lean())?.privateNotes as string | undefined)
    : undefined;

  const ownerId = String(campaign.owner);
  const cards = await loadUserCards(campaign.members);
  const people = [...cards.values()].sort(
    (a, b) => Number(b.id === ownerId) - Number(a.id === ownerId) || a.displayName.localeCompare(b.displayName, "es"),
  );
  const bookNames = campaign.restrictBooks
    ? (await booksByIds(campaign.allowedBooks as string[])).map((b) => b.name)
    : null;

  return { notes, ownerId, people, bookNames };
}

// «Especie Clase N»; con multiclase, «Especie Clase N / Clase M»
function summaryOf(sheet: Parameters<typeof classesOf>[0] & { species?: { name?: string } }) {
  const classes = classesOf(sheet)
    .filter((c) => c.class?.name)
    .map((c) => `${c.class.name}${c.level ? ` ${c.level}` : ""}`)
    .join(" / ");
  return [sheet.species?.name, classes].filter(Boolean).join(" ");
}

/* Personajes de una campaña: el DM ve también las solicitudes pendientes; el resto, los aprobados y sus propias
   solicitudes (pendientes primero). Si la campaña admite personajes externos, también los propios que se pueden
   añadir: del mismo sistema y sin campaña, cada uno con su elegibilidad. */
export async function listCampaignCharacters(campaign: AccessCampaign, userId: string, isDm: boolean) {
  // Mismo criterio que el creador y la ruta de solicitud
  const rules = {
    allowed: campaign.characters?.allowed === true,
    internal: campaign.characters?.internal === true,
    external: campaign.characters?.external === true,
  };

  const visible = isDm ? {} : { $or: [{ campaignStatus: { $ne: "pending" } }, { owner: userId }] };
  const found = await Character.find({ campaign: campaign._id, ...visible })
    .select("name owner status portraitId campaignStatus sheet.species.name sheet.classes.name sheet.classes.level sheet.classesSummary")
    .sort({ createdAt: 1 })
    .lean();
  // Pendientes primero (sort es estable: dentro de cada grupo se mantiene el orden de creación)
  found.sort((a, b) => Number(b.campaignStatus === "pending") - Number(a.campaignStatus === "pending"));

  const ownerCards = await loadUserCards(found.map((c) => c.owner));
  const characters = found.map((c) => {
    const owner = ownerCards.get(String(c.owner));
    return {
      id: String(c._id),
      name: c.name,
      portraitUrl: c.portraitId ? `/api/images/${c.portraitId}` : null,
      summary: summaryOf(c.sheet ?? {}),
      status: c.status ?? "active",
      pending: c.campaignStatus === "pending",
      owner: owner ? { username: owner.username, displayName: owner.displayName } : null,
      isOwn: String(c.owner) === userId,
    };
  });

  const canAdd = rules.allowed && rules.external;
  let addable: { id: string; name: string; summary: string; reason: string | null }[] = [];
  if (canAdd) {
    const mine = await Character.find({ owner: userId, systemId: campaign.systemId, campaign: { $exists: false } })
      .select("name systemId sheet")
      .sort({ name: 1 })
      .collation({ locale: "es", strength: 2 })
      .lean();
    const reasons = await joinReasons(
      userId,
      mine.map((c) => ({ campaign, character: { systemId: c.systemId, sheet: c.sheet } })),
    );
    addable = mine.map((c, i) => ({ id: String(c._id), name: c.name, summary: summaryOf(c.sheet ?? {}), reason: reasons[i] }));
  }

  return { rules, canAdd, characters, addable };
}

/* Participantes de una campaña (el DM primero y después por orden alfabético) y, solo para el DM, el enlace de
   invitación, los bloqueados de la campaña, las invitaciones pendientes y los amigos que se pueden invitar. */
export async function listMembers(campaign: AccessCampaign, userId: string, isDm: boolean) {
  const ownerId = String(campaign.owner);
  const memberIds: string[] = campaign.members.map(String);

  let invite: { code: string | null; expiresAt: string | null } = { code: null, expiresAt: null };
  let bannedIds: string[] = [];
  let pendingIds: string[] = [];
  let eligibleIds: string[] = [];
  if (isDm) {
    const c = await Campaign.findById(campaign._id).select("+inviteCode +inviteExpires banned").lean();
    const valid = !!c?.inviteCode && (!c.inviteExpires || c.inviteExpires > new Date());
    invite = {
      code: valid ? c.inviteCode : null,
      expiresAt: valid && c.inviteExpires ? c.inviteExpires.toISOString() : null,
    };
    bannedIds = (c?.banned ?? []).map(String);
    const pending = await CampaignInvite.find({ campaign: campaign._id }).sort({ createdAt: -1 }).select("user").lean();
    pendingIds = pending.map((p) => String(p.user));

    const [friendIds, hiddenIds] = await Promise.all([friendIdsOf(userId), blockedIdsOf(userId)]);
    const taken = new Set([...memberIds, ...bannedIds, ...pendingIds, ...hiddenIds]);
    eligibleIds = friendIds.filter((f) => !taken.has(f));
  }

  const cards = await loadUserCards([...memberIds, ...bannedIds, ...pendingIds, ...eligibleIds]);
  const friends = eligibleIds
    .map((f) => cards.get(f))
    .filter((u) => !!u)
    .map((u) => ({ username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));

  const people = memberIds
    .map((mid) => ({ id: mid, card: cards.get(mid) }))
    .sort(
      (a, b) =>
        Number(b.id === ownerId) - Number(a.id === ownerId) ||
        (a.card?.displayName ?? "").localeCompare(b.card?.displayName ?? "", "es"),
    );

  return { ownerId, invite, bannedIds, pendingIds, friends, people, cards };
}

export const LOG_PAGE_SIZE = 10;

/* Notas del diario, de la más reciente a la más antigua. El DM ve todas; un jugador, las públicas y las suyas (esto lo
   decide el servidor). `visibility`: "all" o solo las públicas o las privadas. */
export async function listLogEntries(
  campaign: AccessCampaign,
  userId: string,
  isDm: boolean,
  visibility: "all" | "public" | "private",
  page: number,
) {
  const filter = {
    campaign: campaign._id,
    ...(isDm ? {} : { $or: [{ visibility: "public" }, { author: userId }] }),
    ...(visibility !== "all" ? { visibility } : {}),
  };

  const total = await CampaignLogEntry.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / LOG_PAGE_SIZE));
  const entries = await CampaignLogEntry.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * LOG_PAGE_SIZE)
    .limit(LOG_PAGE_SIZE)
    .lean();

  const authors = await loadUserCards(entries.map((e) => e.author));
  return { pages, entries, authors };
}

// Una nota del diario para editarla: solo la ve aquí su autor (si no, null)
export async function logEntryForEdit(campaignId: string, entryId: string, userId: string) {
  if (!isValidId(entryId)) return null;
  return CampaignLogEntry.findOne({ _id: entryId, campaign: campaignId, author: userId }).lean();
}

/* La campaña para el formulario de edición, con las notas privadas (solo el DM: si no, null), y los libros que se
   pueden elegir: los que ve el DM y, aunque ya no los vea, los que ya estaban aprobados. */
export async function campaignForEdit(campaignId: string, userId: string) {
  const full = await Campaign.findOne({ _id: campaignId, owner: userId }).select("+privateNotes").lean();
  if (!full) return null;

  const visible = await visibleBooksOf(userId, full.systemId); // el sistema no cambia al editar
  const approved = await booksByIds((full.allowedBooks ?? []) as string[]);
  const books = [...new Map([...visible, ...approved].map((b) => [b.id, b])).values()];
  return { campaign: full, books };
}
