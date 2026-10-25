import "server-only";
// Datos de las páginas del foro de una campaña. Reciben lo que da getCampaignAccess (quien mira ya es miembro).
import { ForumPost } from "@/lib/models/ForumPost";
import { loadUserCards, type UserCard } from "@/lib/server/account/userCards";
import type { getCampaignAccess } from "@/lib/server/campaigns/campaignAccess";
import { loadReactions } from "@/lib/server/forum/forumData";
import { isValidId } from "@/lib/server/ids";
import { REPLIES_PER_PAGE, THREADS_PER_PAGE, type ReactionState } from "@/lib/shared/forum";
import { pageFrom } from "@/lib/utils/utils";

type AccessCampaign = Awaited<ReturnType<typeof getCampaignAccess>>["campaign"];

/* Hilos de la página pedida (`pageParam`, de la dirección): fijados primero y después por última actividad, cada uno
   con su número de respuestas y el autor de la última. */
export async function listThreads(campaign: AccessCampaign, pageParam: string | string[] | undefined) {
  const filter = { campaign: campaign._id, parent: null };
  const total = await ForumPost.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / THREADS_PER_PAGE));
  const page = pageFrom(pageParam, pages);

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

  return { total, pages, page, threads, statsById, cards };
}

/** Un mensaje del hilo tal como lo pinta ForumMessage, con lo que puede hacer quien mira. */
export type ThreadMessage = {
  id: string;
  rootId: string;
  isRoot: boolean;
  number: number | null;
  title?: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  pinned: boolean;
  author: UserCard | null;
  authorIsDm: boolean;
  replyTo: { name: string; href: string | null } | null;
  reactions: ReactionState;
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
};

/* Un hilo con las respuestas de la página pedida, numeradas. null si no existe en esta campaña. Quien mira puede
   editar sus mensajes; borrar, los suyos o, si es el DM, cualquiera; fijar, solo el DM y solo el mensaje principal. */
export async function loadThread(
  campaign: AccessCampaign,
  postId: string,
  pageParam: string | string[] | undefined,
  userId: string,
  isDm: boolean,
) {
  if (!isValidId(postId)) return null;

  const [root, total] = await Promise.all([
    ForumPost.findOne({ _id: postId, campaign: campaign._id, parent: null }).lean(),
    ForumPost.countDocuments({ parent: postId }),
  ]);
  if (!root) return null;

  const pages = Math.max(1, Math.ceil(total / REPLIES_PER_PAGE));
  const page = pageFrom(pageParam, pages);
  const replies = await ForumPost.find({ parent: root._id })
    .sort({ createdAt: 1 })
    .skip((page - 1) * REPLIES_PER_PAGE)
    .limit(REPLIES_PER_PAGE)
    .lean();

  // A quién contesta cada respuesta dirigida (en paralelo con las reacciones)
  const targetIds = [...new Set(replies.filter((r) => r.replyTo).map((r) => String(r.replyTo)))];
  const [targets, reactions] = await Promise.all([
    targetIds.length ? ForumPost.find({ _id: { $in: targetIds } }).select("author").lean() : [],
    loadReactions([root._id, ...replies.map((r) => r._id)], userId),
  ]);
  const targetAuthor = new Map<string, string>(targets.map((t): [string, string] => [String(t._id), String(t.author)]));
  const cards = await loadUserCards([root.author, ...replies.map((r) => r.author), ...targets.map((t) => t.author)]);

  const dmId = String(campaign.owner);
  const onPage = new Set(replies.map((r) => String(r._id)));

  const toMessage = (p: typeof root, number: number | null): ThreadMessage => {
    const isRoot = number === null;
    const mine = String(p.author) === userId;
    let replyTo: ThreadMessage["replyTo"] = null;
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

  return {
    rootId: String(root._id),
    total,
    pages,
    page,
    root: toMessage(root, null),
    replies: replies.map((r, i) => toMessage(r, (page - 1) * REPLIES_PER_PAGE + i + 1)),
  };
}
