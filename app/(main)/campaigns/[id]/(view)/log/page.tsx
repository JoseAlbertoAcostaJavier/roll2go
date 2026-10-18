import Link from "next/link";
import { Globe, Lock, Pencil, Plus } from "lucide-react";
import Bbcode from "@/app/components/Bbcode";
import ConfirmAction from "@/app/components/ConfirmAction";
import { getCampaignAccess } from "@/lib/campaignAccess";
import { CampaignLogEntry } from "@/lib/CampaignLogEntry";
import { User } from "@/lib/User";

const PAGE_SIZE = 10;
const FILTERS = [
  ["all", "Todas"],
  ["public", "Públicas"],
  ["private", "Privadas"],
] as const;

const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
const dateFormat = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Madrid",
});

export default async function CampaignLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { session, campaign, isDm } = await getCampaignAccess(id);

  const v = FILTERS.find(([key]) => key === first(sp.v))?.[0] ?? "all";
  const page = Math.min(Math.max(parseInt(first(sp.page) ?? "1", 10) || 1, 1), 1000);

  const filter = {
    campaign: campaign._id,
    // El DM ve todas las notas; un jugador, las públicas y las suyas. Esto lo decide el servidor.
    ...(isDm ? {} : { $or: [{ visibility: "public" }, { author: session.id }] }),
    ...(v !== "all" ? { visibility: v } : {}),
  };

  const total = await CampaignLogEntry.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const entries = await CampaignLogEntry.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  const authorIds = [...new Set(entries.map((e) => String(e.author)))];
  const authors = await User.find({ _id: { $in: authorIds } }).select("username").lean();
  const authorName = new Map<string, string>(authors.map((u): [string, string] => [String(u._id), String(u.username)]));

  const href = (p: number, filterKey: string) => {
    const q = new URLSearchParams();
    if (filterKey !== "all") q.set("v", filterKey);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return `/campaigns/${id}/log${s ? `?${s}` : ""}`;
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-bold uppercase tracking-wide">Diario de campaña</h2>
        <Link
          href={`/campaigns/${id}/log/new`}
          className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-hover"
        >
          <Plus size={16} aria-hidden="true" /> Nueva nota
        </Link>
      </div>

      <nav aria-label="Filtrar notas" className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => (
          <Link
            key={key}
            href={href(1, key)}
            aria-current={v === key ? "true" : undefined}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              v === key ? "border-brand bg-brand/10 text-white" : "border-line text-muted hover:text-white"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {entries.length === 0 ? (
        <div className="rounded-md bg-surface p-4 text-sm text-muted">
          {v === "all" ? "El diario todavía no tiene notas." : "No hay notas con ese filtro."}
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((e) => {
            const mine = String(e.author) === session.id;
            const isPublic = e.visibility === "public";
            const edited = new Date(e.updatedAt).getTime() - new Date(e.createdAt).getTime() > 1000;
            return (
              <article key={String(e._id)} className="rounded-lg border border-line bg-surface p-5">
                <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-lg font-bold">{e.title}</h3>
                    <p className="text-xs text-muted">
                      {authorName.get(String(e.author)) ?? "Participante eliminado"} ·{" "}
                      {dateFormat.format(new Date(e.createdAt))}
                      {edited && " · editada"}
                    </p>
                  </div>
                  <span
                    title={isPublic ? "La ven todos los participantes" : "Solo la ven su autor y el DM"}
                    className="flex items-center gap-1 rounded-full bg-panel px-3 py-1 text-xs text-muted"
                  >
                    {isPublic ? <Globe size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
                    {isPublic ? "Pública" : "Privada"}
                  </span>
                </header>

                <Bbcode source={e.content} className="text-sm" />

                {(mine || isDm) && (
                  <footer className="mt-4 flex flex-wrap items-center gap-5 border-t border-line pt-3">
                    {mine && (
                      <Link
                        href={`/campaigns/${id}/log/${e._id}/edit`}
                        className="flex items-center gap-1 text-sm text-muted hover:text-white"
                      >
                        <Pencil size={14} aria-hidden="true" /> Editar
                      </Link>
                    )}
                    <ConfirmAction
                      url={`/api/campaigns/${id}/log/${e._id}`}
                      label="Borrar"
                      question="¿Borrar esta nota?"
                      confirmLabel="Sí, borrar"
                    />
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Paginación" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={href(page - 1, v)} className="text-muted hover:text-white">← Más recientes</Link>
          ) : (
            <span />
          )}
          <span className="text-muted">Página {page} de {pages}</span>
          {page < pages ? (
            <Link href={href(page + 1, v)} className="text-muted hover:text-white">Más antiguas →</Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}