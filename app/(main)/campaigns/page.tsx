import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Campaign } from "@/lib/Campaign";
import { system as rpgSystems } from "@/lib/systems";
import Avatar from "@/app/components/Avatar";
import CampaignInvites, { type InviteData } from "@/app/components/CampaignInvites";
import ConfirmAction from "@/app/components/ConfirmAction";
import { CampaignInvite } from "@/lib/CampaignInvite";
import { loadUserCards } from "@/lib/userCards";
import { escapeRegex, first } from "@/lib/utils";

export const metadata: Metadata = { title: "Mis campañas" };

const OWNERS = ["all", "mine", "others"] as const;
const STATUSES = ["active", "inactive", "all"] as const;
const SORTS = ["recent", "new", "name"] as const;

// Devuelve el valor solo si es uno de los permitidos; si no, el valor por defecto
function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.find((a) => a === value) ?? fallback;
}

const field =
  "h-11 w-full rounded-md border border-line bg-surface px-3 text-fg placeholder:text-muted focus:border-brand focus:outline-none";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // Valores por defecto: Todas, Activas, Recientes primero
  const q = (first(sp.q) ?? "").trim().slice(0, 80);
  const owner = pick(first(sp.owner), OWNERS, "all");
  const status = pick(first(sp.status), STATUSES, "active");
  const sort = pick(first(sp.sort), SORTS, "recent");
  const hasFilters = q !== "" || owner !== "all" || status !== "active" || sort !== "recent";

  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect("/sign_in?next=/campaigns");

  await connectDB();

  // Siempre solo las campañas de las que el usuario es miembro
  const filter: Record<string, unknown> = { members: session.id };
  if (owner === "mine") filter.owner = session.id;
  if (owner === "others") filter.owner = { $ne: session.id };
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
      .limit(100)
      .lean(),
    CampaignInvite.find({ user: session.id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  // DM de cada campaña, campañas de las invitaciones y quién invita
  const [ownerCards, inviteCampaigns, inviterCards] = await Promise.all([
    loadUserCards(campaigns.map((c) => c.owner)),
    Campaign.find({ _id: { $in: invites.map((i) => i.campaign) } }).select("name systemId").lean(),
    loadUserCards(invites.map((i) => i.invitedBy)),
  ]);
  const inviteCampaignById = new Map(inviteCampaigns.map((c) => [String(c._id), c] as const));
  const inviteData: InviteData[] = invites.flatMap((i) => {
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

  return (
    <div className="mx-auto max-w-280 px-5 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl font-extrabold">Mis campañas</h1>
        <Link
          href="/campaigns/new"
          className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 font-heading text-sm font-bold text-white transition-colors hover:bg-brand-hover"
        >
          <Plus size={16} aria-hidden="true" /> Crear campaña
        </Link>
      </div>

      <CampaignInvites invites={inviteData} />

      {/* Buscador: es un formulario GET, así que los filtros quedan en la dirección y funciona sin JavaScript.
          La key reinicia los campos cuando cambian los filtros (por ejemplo al pulsar "Limpiar"). */}
      <form
        key={`${q}|${owner}|${status}|${sort}`}
        action="/campaigns"
        method="get"
        className="mb-6 rounded-lg border border-line bg-panel p-5"
      >
        <h2 className="mb-4 font-heading text-sm font-bold uppercase tracking-wide text-muted">Buscar campañas</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={80}
            placeholder="Buscar por nombre"
            aria-label="Buscar por nombre"
            className={field}
          />
          <select name="owner" defaultValue={owner} aria-label="Creadas por" className={field}>
            <option value="all">Todas</option>
            <option value="mine">Creadas por mí</option>
            <option value="others">Creadas por otros</option>
          </select>
          <select name="status" defaultValue={status} aria-label="Estado" className={field}>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
            <option value="all">Todas</option>
          </select>
          <select name="sort" defaultValue={sort} aria-label="Ordenar por" className={field}>
            <option value="recent">Recientes primero</option>
            <option value="new">Nuevas primero</option>
            <option value="name">Ordenar por nombre</option>
          </select>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="h-11 flex-1 rounded-md bg-brand px-6 font-heading font-bold text-white transition-colors hover:bg-brand-hover"
            >
              Buscar
            </button>
            {hasFilters && (
              <Link href="/campaigns" className="text-sm text-muted hover:text-white">
                Limpiar
              </Link>
            )}
          </div>
        </div>
      </form>

      {campaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-10 text-center text-muted">
          {hasFilters ? (
            <p>No se han encontrado campañas con esos filtros.</p>
          ) : (
            <>
              <p className="mb-4">No tienes campañas activas.</p>
              <Link href="/campaigns/new" className="font-semibold text-brand-soft hover:underline">
                Crea tu primera campaña
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
          {campaigns.map((c, i) => {
            const players = Math.max(0, (c.members?.length ?? 1) - 1); // sin contar al DM
            const mine = String(c.owner) === session.id;
            const owner = ownerCards.get(String(c.owner));
            return (
              /* La tarjeta entera abre la campaña gracias al enlace "estirado" del título (after:inset-0).
                 El pie queda por encima (z-10) para que el enlace al DM y el botón de abandonar funcionen. */
              <article
                key={String(c._id)}
                style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                className="group relative flex animate-fade-up flex-col overflow-hidden rounded-lg border border-line bg-panel transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_10px_30px_rgba(0,0,0,0.45)] has-[a:focus-visible]:border-brand"
              >
                <div className="relative h-36 overflow-hidden bg-surface">
                  {c.imageId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/images/${c.imageId}`} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  )}
                  {c.logoId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/images/${c.logoId}`} alt="" loading="lazy" className="absolute bottom-2 left-2 h-12 w-12 rounded-md bg-surface object-cover shadow-md" />
                  )}
                  {c.status === "inactive" && (
                    <span className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs font-semibold text-muted">
                      Inactiva
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h2 className="font-heading text-lg font-bold">
                    <Link href={`/campaigns/${c._id}`} className="outline-none after:absolute after:inset-0 after:content-['']">
                      {c.name}
                    </Link>
                  </h2>
                  {c.shortDescription && <p className="mt-1 line-clamp-3 text-sm text-muted">{c.shortDescription}</p>}
                  <p className="mt-3 text-sm font-semibold">
                    {rpgSystems.find((s) => s.id === c.systemId)?.name ?? c.systemId}
                  </p>
                  <p className="text-sm text-muted">
                    {players} {players === 1 ? "jugador" : "jugadores"}
                  </p>
                  <div className="relative z-10 mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3">
                    {owner ? (
                      <Link href={`/users/${owner.username}`} className="group/dm flex min-w-0 items-center gap-2 text-sm">
                        <Avatar url={owner.avatarUrl} size={24} crown />
                        <span className="truncate font-semibold text-[#6fd08c]">
                          Creada por <span className="group-hover/dm:underline">{owner.displayName}</span>
                        </span>
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2 text-sm text-muted">
                        <Avatar url={null} size={24} crown /> Creada por un usuario eliminado
                      </span>
                    )}
                    {mine ? (
                      <span className="text-xs text-muted">(tú, DM)</span>
                    ) : (
                      <ConfirmAction
                        url={`/api/campaigns/${c._id}/members/${session.id}`}
                        label="Abandonar"
                        question={`¿Abandonar ${c.name}?`}
                        confirmLabel="Sí, abandonar"
                      />
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}