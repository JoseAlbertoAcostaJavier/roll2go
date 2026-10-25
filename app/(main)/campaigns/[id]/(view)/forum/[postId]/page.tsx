import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import ForumMessage, { type ForumMessageData } from "@/app/components/forum/ForumMessage";
import ForumPostForm from "@/app/components/forum/ForumPostForm";
import Pagination from "@/app/components/ui/Pagination";
import { getCampaignAccess } from "@/lib/server/campaigns/campaignAccess";
import { loadThread } from "@/lib/server/forum/queries";

export default async function ForumThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; postId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, postId } = await params;
  const sp = await searchParams;
  const { session, campaign, isDm } = await getCampaignAccess(id);
  // El hilo con las respuestas de esta página y lo que puede hacer quien mira en cada mensaje
  const thread = await loadThread(campaign, postId, sp.page, session.id, isDm);
  if (!thread) notFound();
  const { total, pages, page } = thread;
  const root: ForumMessageData = thread.root;
  const replies: ForumMessageData[] = thread.replies;
  const base = `/campaigns/${id}/forum/${postId}`;

  return (
    <section>
      <Link href={`/campaigns/${id}/forum`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-white">
        <ChevronLeft size={16} aria-hidden="true" /> Foro
      </Link>

      <ForumMessage campaignId={id} data={root} />

      <h3 className="mb-3 mt-8 flex items-center gap-3 font-heading text-lg font-bold">
        {total === 0 ? "Sin respuestas todavía" : `${total} ${total === 1 ? "respuesta" : "respuestas"}`}
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </h3>
      {replies.length > 0 && (
        <div className="space-y-3 border-l-2 border-line sm:ml-3 sm:pl-5">
          {replies.map((r) => (
            <ForumMessage key={r.id} campaignId={id} data={r} />
          ))}
        </div>
      )}

      <Pagination page={page} pages={pages} href={(n) => `${base}?page=${n}`} />

      <section id="responder" className="mt-8 scroll-mt-24 rounded-lg border border-line bg-surface p-5">
        <h3 className="mb-4 font-heading text-lg font-bold">Responder al hilo</h3>
        <ForumPostForm campaignId={id} kind="reply" parent={thread.rootId} />
      </section>
    </section>
  );
}
