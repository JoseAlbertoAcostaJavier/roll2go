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
import ListFilters from "@/app/components/ui/ListFilters";

export const metadata: Metadata = { title: "Mis campañas" };

const OWNERS = ["all", "mine", "others"] as const;
const STATUSES = ["active", "inactive", "all"] as const;
const SORTS = ["recent", "new", "name"] as const;

// Devuelve el valor solo si es uno de los permitidos; si no, el valor por defecto
function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.find((a) => a === value) ?? fallback;
}

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

      <ListFilters
        className="mb-6 rounded-lg border border-line bg-panel p-5"
        base="/campaigns"
        title="Buscar campañas"
        q={q}
        searchLabel="Buscar por nombre"
        placeholder="Buscar por nombre"
        selects={[
          {
            name: "owner", label: "Creadas por", value: owner, defaultValue: "all",
            options: [
              { value: "all", label: "Todas" },
              { value: "mine", label: "Creadas por mí" },
              { value: "others", label: "Creadas por otros" },
            ],
          },
          {
            name: "status", label: "Estado", value: status, defaultValue: "active",
            options: [
              { value: "active", label: "Activas" },
              { value: "inactive", label: "Inactivas" },
              { value: "all", label: "Todas" },
            ],
          },
          {
            name: "sort", label: "Ordenar por", value: sort, defaultValue: "recent",
            options: [
              { value: "recent", label: "Recientes primero" },
              { value: "new", label: "Nuevas primero" },
              { value: "name", label: "Ordenar por nombre" },
            ],
          },
        ]}
      />

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