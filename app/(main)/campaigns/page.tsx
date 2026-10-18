import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Plus, User as UserIcon } from "lucide-react";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Campaign } from "@/lib/Campaign";
import { User } from "@/lib/User";
import { system as rpgSystems } from "@/lib/systems";

export const metadata: Metadata = { title: "Mis campañas" };

const OWNERS = ["all", "mine", "others"] as const;
const STATUSES = ["active", "inactive", "all"] as const;
const SORTS = ["recent", "new", "name"] as const;

// Devuelve el valor solo si es uno de los permitidos; si no, el valor por defecto
function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.find((a) => a === value) ?? fallback;
}
const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

  const campaigns = await Campaign.find(filter)
    .select("name systemId status owner members imageId logoId shortDescription")
    .sort(sortBy)
    .collation({ locale: "es", strength: 2 }) // ordena por nombre sin distinguir mayúsculas ni tildes
    .limit(100)
    .lean();

  // Nombre de usuario de los DM de las campañas
  const ownerIds = [...new Set(campaigns.map((c) => String(c.owner)))];
  const owners = await User.find({ _id: { $in: ownerIds } }).select("username").lean();
  const ownerName = new Map<string, string>(owners.map((u): [string, string] => [String(u._id), String(u.username)]));

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
          {campaigns.map((c) => {
            const players = Math.max(0, (c.members?.length ?? 1) - 1); // sin contar al DM
            const mine = String(c.owner) === session.id;
            return (
              <Link
                key={String(c._id)}
                href={`/campaigns/${c._id}`}
                className="overflow-hidden rounded-lg border border-line bg-panel transition-colors hover:border-brand"
              >
                <div className="relative h-36 bg-surface">
                  {c.imageId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/images/${c.imageId}`} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                  {c.logoId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/images/${c.logoId}`} alt="" loading="lazy" className="absolute bottom-2 left-2 h-12 w-12 rounded-md bg-surface object-cover" />
                  )}
                  {c.status === "inactive" && (
                    <span className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs font-semibold text-muted">
                      Inactiva
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-heading text-lg font-bold">{c.name}</h2>
                  {c.shortDescription && <p className="mt-1 line-clamp-3 text-sm text-muted">{c.shortDescription}</p>}
                  <p className="mt-3 text-sm font-semibold">
                    {rpgSystems.find((s) => s.id === c.systemId)?.name ?? c.systemId}
                  </p>
                  <p className="text-sm text-muted">
                    {players} {players === 1 ? "participante" : "participantes"}
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-sm">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-muted">
                      <UserIcon size={14} aria-hidden="true" />
                    </span>
                    <span className="font-semibold text-[#6fd08c]">{ownerName.get(String(c.owner)) ?? "Desconocido"}</span>
                    {mine && <span className="text-xs text-muted">(tú, DM)</span>}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}