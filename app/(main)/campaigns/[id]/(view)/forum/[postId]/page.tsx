import Link from "next/link";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { ChevronLeft } from "lucide-react";
import ForumMessage, { type ForumMessageData } from "@/app/components/ForumMessage";
import ForumPostForm from "@/app/components/ForumPostForm";
import Pagination from "@/app/components/Pagination";
import { getCampaignAccess } from "@/lib/campaignAccess";
import { ForumPost } from "@/lib/ForumPost";
import { REPLIES_PER_PAGE } from "@/lib/forum";
import { loadReactions } from "@/lib/forumData";
import { loadUserCards } from "@/lib/userCards";

const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

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
  if (!mongoose.isValidObjectId(postId)) notFound();

  const [root, total] = await Promise.all([
    ForumPost.findOne({ _id: postId, campaign: campaign._id, parent: null }).lean(),
    ForumPost.countDocuments({ parent: postId }),
  ]);
  if (!root) notFound();

  const pages = Math.max(1, Math.ceil(total / REPLIES_PER_PAGE));
  const page = Math.min(Math.max(parseInt(first(sp.page) ?? "1", 10) || 1, 1), pages);
  const replies = await ForumPost.find({ parent: root._id })
    .sort({ createdAt: 1 })
    .skip((page - 1) * REPLIES_PER_PAGE)
    .limit(REPLIES_PER_PAGE)
    .lean();

  // A quién contesta cada respuesta dirigida (en paralelo con las reacciones)
  const targetIds = [...new Set(replies.filter((r) => r.replyTo).map((r) => String(r.replyTo)))];
  const [targets, reactions] = await Promise.all([
    targetIds.length ? ForumPost.find({ _id: { $in: targetIds } }).select("author").lean() : [],
    loadReactions([root._id, ...replies.map((r) => r._id)], session.id),
  ]);
  const targetAuthor = new Map<string, string>(targets.map((t): [string, string] => [String(t._id), String(t.author)]));
  const cards = await loadUserCards([root.author, ...replies.map((r) => r.author), ...targets.map((t) => t.author)]);

  const dmId = String(campaign.owner);
  const onPage = new Set(replies.map((r) => String(r._id)));
  const base = `/campaigns/${id}/forum/${postId}`;

  const toMessage = (p: typeof root, number: number | null): ForumMessageData => {
    const isRoot = number === null;
    const mine = String(p.author) === session.id;
    let replyTo: ForumMessageData["replyTo"] = null;
    if (p.replyTo) {
      const targetId = targetAuthor.get(String(p.replyTo));
      replyTo = {
        name: targetId ? (cards.get(targetId)?.displayName ?? "un participante") : "un mensaje eliminado",
        // Solo se enlaza si la respuesta contestada está en esta misma página
        href: onPage.has(String(p.replyTo)) ? `#msg-${p.replyTo}` : null,
      };
    }
    return {
      id: String(p._id),
      rootId: String(root._id),
      isRoot,
      number,
      title: isRoot ? p.title : undefined,
      content: p.content,
      createdAt: new Date(p.createdAt).toISOString(),
      editedAt: p.editedAt ? new Date(p.editedAt).toISOString() : null,
      pinned: !!p.pinned,
      author: cards.get(String(p.author)) ?? null,
      authorIsDm: String(p.author) === dmId,
      replyTo,
      reactions: reactions.get(String(p._id)) ?? {},
      canEdit: mine,
      canDelete: mine || isDm,
      canPin: isDm && isRoot,
    };
  };

  return (
    <section>
      <Link href={`/campaigns/${id}/forum`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-white">
        <ChevronLeft size={16} aria-hidden="true" /> Foro
      </Link>

      <ForumMessage campaignId={id} data={toMessage(root, null)} />

      <h3 className="mb-3 mt-8 flex items-center gap-3 font-heading text-lg font-bold">
        {total === 0 ? "Sin respuestas todavía" : `${total} ${total === 1 ? "respuesta" : "respuestas"}`}
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </h3>
      {replies.length > 0 && (
        <div className="space-y-3 border-l-2 border-line sm:ml-3 sm:pl-5">
          {replies.map((r, i) => (
            <ForumMessage
              key={String(r._id)}
              campaignId={id}
              data={toMessage(r, (page - 1) * REPLIES_PER_PAGE + i + 1)}
            />
          ))}
        </div>
      )}

      <Pagination page={page} pages={pages} href={(n) => `${base}?page=${n}`} />

      <section id="responder" className="mt-8 scroll-mt-24 rounded-lg border border-line bg-surface p-5">
        <h3 className="mb-4 font-heading text-lg font-bold">Responder al hilo</h3>
        <ForumPostForm campaignId={id} kind="reply" parent={String(root._id)} />
      </section>
    </section>
  );
}
