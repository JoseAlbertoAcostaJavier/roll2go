import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Ban, Search, ShieldAlert, TriangleAlert } from "lucide-react";
import AdminUserActions from "@/app/components/AdminUserActions";
import LocalDate from "@/app/components/LocalDate";
import Pagination from "@/app/components/Pagination";
import UserLink from "@/app/components/UserLink";
import { requireAdmin } from "@/lib/currentUser";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/User";
import { escapeRegex, first, pageFrom } from "@/lib/utils";

export const metadata: Metadata = { title: "Usuarios de Roll2Go" };

const PER_PAGE = 20;
const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "warned", label: "Con advertencias" },
  { id: "banned", label: "Baneados" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

type Warning = { reason: string; createdAt: Date };

const field =
  "h-11 w-full rounded-md border border-line bg-surface pl-10 pr-3 text-fg placeholder:text-muted focus:border-brand focus:outline-none";
const chip = "rounded-full border px-3 py-1 text-sm transition-colors";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireAdmin(); // a quien no es administrador le da 404
  const sp = await searchParams;
  const q = (first(sp.q) ?? "").trim().replace(/^@/, "").slice(0, 40);
  const filterId: FilterId = FILTERS.find((f) => f.id === first(sp.filter))?.id ?? "all";

  // Búsqueda por el principio del @usuario o del nombre visible (los dos campos en minúsculas tienen índice)
  const filter: Record<string, unknown> = {};
  if (q) {
    const prefix = new RegExp("^" + escapeRegex(q.toLowerCase()));
    filter.$or = [{ usernameLower: prefix }, { displayNameLower: prefix }];
  }
  if (filterId === "banned") filter.bannedAt = { $ne: null };
  if (filterId === "warned") filter["warnings.0"] = { $exists: true };

  await connectDB();
  const total = await User.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = pageFrom(sp.page, pages);
  const users = await User.find(filter)
    .select("username displayName email verified createdAt avatarId role warnings bannedAt banReason")
    .sort({ createdAt: -1 })
    .skip((page - 1) * PER_PAGE)
    .limit(PER_PAGE)
    .lean();

  const hrefFor = (params: { q?: string; filter?: FilterId; page?: number }) => {
    const s = new URLSearchParams();
    const nq = params.q ?? q;
    const nf = params.filter ?? filterId;
    if (nq) s.set("q", nq);
    if (nf !== "all") s.set("filter", nf);
    if (params.page && params.page > 1) s.set("page", String(params.page));
    const qs = s.toString();
    return `/admin/users${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="font-heading text-3xl font-extrabold">Usuarios de Roll2Go</h1>
          <p className="mt-1 text-sm text-muted">
            {total === 1 ? "1 usuario" : `${total} usuarios`}
            {q || filterId !== "all" ? " con estos filtros" : " registrados"}
          </p>
        </div>
      </div>

      <form action="/admin/users" className="mb-4 animate-fade-up" role="search">
        {filterId !== "all" && <input type="hidden" name="filter" value={filterId} />}
        <label htmlFor="user-q" className="sr-only">Buscar por nombre o @usuario</label>
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="user-q" name="q" defaultValue={q} placeholder="Buscar por nombre o @usuario" className={field} />
        </div>
      </form>

      <nav aria-label="Filtros" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={hrefFor({ filter: f.id })}
            aria-current={f.id === filterId ? "page" : undefined}
            className={`${chip} ${
              f.id === filterId
                ? "border-brand bg-brand/15 text-white"
                : "border-line text-muted hover:border-muted hover:text-white"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {users.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-muted animate-fade-in">
          No hay usuarios que coincidan.
        </p>
      ) : (
        <ul className="space-y-3">
          {users.map((u, i) => {
            const id = String(u._id);
            const warnings = [...((u.warnings ?? []) as Warning[])].reverse(); // la más reciente primero
            const isAdmin = u.role === "admin";
            const banned = !!u.bannedAt;
            return (
              <li
                key={id}
                style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                className={`rounded-lg border bg-panel p-4 animate-fade-up ${banned ? "border-brand-dark" : "border-line"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <UserLink
                      user={{
                        id,
                        username: u.username,
                        displayName: u.displayName || u.username,
                        avatarUrl: u.avatarId ? `/api/images/${u.avatarId}` : null,
                      }}
                      size={40}
                      showHandle
                    />
                    <p className="mt-2 truncate text-sm text-muted">{u.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {isAdmin && (
                      <span className="flex items-center gap-1 rounded-full bg-line px-2 py-0.5 text-white">
                        <ShieldAlert size={12} aria-hidden="true" /> Admin
                      </span>
                    )}
                    {u.verified ? (
                      <span className="flex items-center gap-1 rounded-full bg-[#6fd08c]/15 px-2 py-0.5 text-[#6fd08c]">
                        <BadgeCheck size={12} aria-hidden="true" /> Verificado
                      </span>
                    ) : (
                      <span className="rounded-full bg-line px-2 py-0.5 text-muted">Sin verificar</span>
                    )}
                    {warnings.length > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-[#e0a33a]/15 px-2 py-0.5 text-[#e0a33a]">
                        <TriangleAlert size={12} aria-hidden="true" />
                        {warnings.length === 1 ? "1 advertencia" : `${warnings.length} advertencias`}
                      </span>
                    )}
                    {banned && (
                      <span className="flex items-center gap-1 rounded-full bg-brand/20 px-2 py-0.5 font-semibold text-brand-soft">
                        <Ban size={12} aria-hidden="true" /> Baneado
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-2 text-xs text-muted">
                  Alta: <LocalDate iso={new Date(u.createdAt).toISOString()} withTime={false} />
                  {banned && (
                    <>
                      {" · "}Baneado el <LocalDate iso={new Date(u.bannedAt).toISOString()} withTime={false} />
                    </>
                  )}
                </p>
                {banned && u.banReason && (
                  <p className="mt-1 text-sm text-brand-soft">Motivo del baneo: {u.banReason}</p>
                )}

                {warnings.length > 0 && (
                  <details className="group mt-3 text-sm">
                    <summary className="cursor-pointer select-none text-muted hover:text-white">
                      Historial de advertencias
                    </summary>
                    <ol className="mt-2 space-y-2 border-l-2 border-line pl-3 animate-fade-in">
                      {warnings.map((w, j) => (
                        <li key={j}>
                          <span className="block text-xs text-muted">
                            <LocalDate iso={new Date(w.createdAt).toISOString()} />
                          </span>
                          {w.reason}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}

                <AdminUserActions
                  id={id}
                  username={u.username}
                  banned={banned}
                  canWarn={id !== me.id}
                  canBan={id !== me.id && !isAdmin}
                />
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} pages={pages} href={(n) => hrefFor({ page: n })} />
    </div>
  );
}
