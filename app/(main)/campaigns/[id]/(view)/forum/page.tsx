import Link from "next/link";
import { MessageSquare, MessagesSquare, Pin, Plus } from "lucide-react";
import Avatar from "@/app/components/Avatar";
import LocalDate from "@/app/components/LocalDate";
import Pagination from "@/app/components/Pagination";
import { getCampaignAccess } from "@/lib/campaignAccess";
import { ForumPost } from "@/lib/ForumPost";
import { THREADS_PER_PAGE } from "@/lib/forum";
import { loadUserCards } from "@/lib/userCards";

const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

const newButton =
  "flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-hover";

export default async function ForumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { campaign } = await getCampaignAccess(id);

  const filter = { campaign: campaign._id, parent: null };
  const total = await ForumPost.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / THREADS_PER_PAGE));
  const page = Math.min(Math.max(parseInt(first(sp.page) ?? "1", 10) || 1, 1), pages);

  // Fijados primero y después por última actividad
  const threads = await ForumPost.find(filter)
    .select("author title pinned createdAt lastActivityAt")
    .sort({ pinned: -1, lastActivityAt: -1 })
    .skip((page - 1) * THREADS_PER_PAGE)
    .limit(THREADS_PER_PAGE)
    .lean();

  // Número de respuestas y autor de la última de cada hilo, en una sola consulta
  const stats = await ForumPost.aggregate<{ _id: unknown; n: number; lastAuthor: unknown }>([
    { $match: { parent: { $in: threads.map((t) => t._id) } } },
    { $sort: { createdAt: 1 } },
    { $group: { _id: "$parent", n: { $sum: 1 }, lastAuthor: { $last: "$author" } } },
  ]);
  const statsById = new Map(stats.map((s) => [String(s._id), s]));
  const cards = await loadUserCards([...threads.map((t) => t.author), ...stats.map((s) => s.lastAuthor)]);

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">Foro de la campaña</h2>
          {total > 0 && (
            <p className="text-xs text-muted">
              {total} {total === 1 ? "hilo" : "hilos"}
            </p>
          )}
        </div>
        {total > 0 && (
          <Link href={`/campaigns/${id}/forum/new`} className={newButton}>
            <Plus size={16} aria-hidden="true" /> Nuevo mensaje
          </Link>
        )}
      </div>

      {threads.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line bg-surface px-4 py-10 text-center">
          <MessagesSquare size={32} className="text-muted" aria-hidden="true" />
          <p className="text-sm text-muted">
            Todavía no hay mensajes en el foro. Escribe el primero para empezar la conversación.
          </p>
          <Link href={`/campaigns/${id}/forum/new`} className={newButton}>
            <Plus size={16} aria-hidden="true" /> Nuevo mensaje
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {threads.map((t) => {
            const s = statsById.get(String(t._id));
            const n = s?.n ?? 0;
            const author = cards.get(String(t.author));
            const last = s ? cards.get(String(s.lastAuthor)) : undefined;
            return (
              <li key={String(t._id)}>
                <Link
                  href={`/campaigns/${id}/forum/${t._id}`}
                  className={`group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-panel ${
                    t.pinned ? "border-l-2 border-brand" : ""
                  }`}
                >
                  <Avatar url={author?.avatarUrl ?? null} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-heading font-bold group-hover:text-white">
                      {t.pinned && (
                        <Pin size={14} className="shrink-0 text-brand-soft" aria-label="Fijado" />
                      )}
                      <span className="truncate">{t.title}</span>
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {author?.displayName ?? "Participante eliminado"} · <LocalDate iso={new Date(t.createdAt).toISOString()} withTime={false} />
                    </span>
                  </span>
                  <span className="hidden shrink-0 flex-col items-end gap-0.5 text-right text-xs text-muted sm:flex">
                    <span>
                      {last ? <>Última respuesta de <strong className="font-semibold text-fg">{last.displayName}</strong></> : "Sin respuestas"}
                    </span>
                    <LocalDate iso={new Date(t.lastActivityAt).toISOString()} />
                  </span>
                  <span
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-panel px-2.5 py-1 text-xs font-semibold text-muted group-hover:bg-surface"
                    aria-label={`${n} ${n === 1 ? "respuesta" : "respuestas"}`}
                  >
                    <MessageSquare size={12} aria-hidden="true" /> {n}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} pages={pages} href={(n) => `/campaigns/${id}/forum?page=${n}`} />
    </section>
  );
}
