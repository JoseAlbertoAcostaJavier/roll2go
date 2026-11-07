import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { COOKIE_NAME, verifySession } from "@/lib/server/auth/auth";
import { campaignCardOf, listMyCampaigns } from "@/lib/server/campaigns/queries";
import CampaignCard from "@/app/components/campaigns/CampaignCard";
import CampaignInvites, { type InviteData } from "@/app/components/campaigns/CampaignInvites";
import { first } from "@/lib/utils/utils";
import { secondaryButton } from "@/app/components/ui/formStyles";

export const metadata: Metadata = { title: "Mis campañas" };

const OWNERS = ["all", "mine", "others"] as const;
const STATUSES = ["active", "inactive", "all"] as const;
const SORTS = ["recent", "new", "name"] as const;

// Devuelve el valor solo si es uno de los permitidos; si no, el valor por defecto
function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.find((a) => a === value) ?? fallback;
}

const field =
  "h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-fg placeholder:text-muted focus:border-brand focus:outline-none";

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

  const { campaigns, ownerCards, invites } = await listMyCampaigns(session.id, { q, owner, status, sort });
  const inviteData: InviteData[] = invites;

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
              className={`${secondaryButton} h-11 flex-1`}
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
            const owner = ownerCards.get(String(c.owner));
            return (
              <CampaignCard
                key={String(c._id)}
                index={i}
                userId={session.id}
                owner={owner ? { username: owner.username, displayName: owner.displayName, avatarUrl: owner.avatarUrl } : null}
                campaign={campaignCardOf(c, session.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}