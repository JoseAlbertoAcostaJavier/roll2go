import Link from "next/link";
import { MessageSquare, MessagesSquare, Pin, Plus } from "lucide-react";
import Avatar from "@/app/components/ui/Avatar";
import LocalDate from "@/app/components/ui/LocalDate";
import Pagination from "@/app/components/ui/Pagination";
import { getCampaignAccess } from "@/lib/server/campaigns/campaignAccess";
import { listThreads } from "@/lib/server/forum/queries";

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

  // Fijados primero y después por última actividad, con sus respuestas y el autor de la última
  const { total, pages, page, threads, statsById, cards } = await listThreads(campaign, sp.page);

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="break-words font-heading text-lg font-bold uppercase tracking-wide">Foro de {campaign.name}</h2>
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
              <li key={String(t._id)} className="animate-fade-in">
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
