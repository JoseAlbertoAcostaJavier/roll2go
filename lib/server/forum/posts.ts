import "server-only";
// Mensajes del foro de una campaña: publicar (cualquier participante), editar (su autor), fijar (el DM), borrar (su
// autor o el DM) y reaccionar. `ctx` viene de requireMember.
import { ForumPost } from "@/lib/models/ForumPost";
import { ForumReaction } from "@/lib/models/ForumReaction";
import { Notification } from "@/lib/models/Notification";
import type { MemberContext } from "@/lib/server/campaigns/campaignApi";
import { isValidId } from "@/lib/server/ids";
import { notify } from "@/lib/server/notifications/notify";
import { fail, invalid, type Result } from "@/lib/server/result";
import { REPLIES_PER_PAGE, parseForumBody } from "@/lib/shared/forum";

type Created = Result<{ id: string; rootId: string; page: number }>;
type ForumValue = ReturnType<typeof parseForumBody>["value"];

const logError = (err: unknown) => console.error("No se pudo enviar el aviso del foro:", err);
const gone = () => fail(404, "El mensaje ya no existe.");
const publishFailed = (err: unknown) => {
  console.error("Error al publicar en el foro:", err);
  return fail(500, "No se pudo publicar. Inténtalo de nuevo.");
};

// Mensaje principal (un hilo nuevo): avisa a todos los demás participantes
export async function createThread(ctx: MemberContext, campaignId: string, value: ForumValue): Promise<Created> {
  try {
    const post = await ForumPost.create({
      campaign: ctx.campaign._id,
      author: ctx.session.id,
      title: value.title,
      content: value.content,
      lastActivityAt: new Date(),
    });
    const others = ctx.campaign.members.map(String).filter((m) => m !== ctx.session.id);
    await Promise.all(
      others.map((user) =>
        notify({ user, type: "campaign_post", actor: ctx.session.id, campaign: campaignId, post: String(post._id) }).catch(logError),
      ),
    );
    return { ok: true, id: String(post._id), rootId: String(post._id), page: 1 };
  } catch (err) {
    return publishFailed(err);
  }
}

/* Respuesta a un hilo; `replyTo`, otra respuesta concreta del mismo hilo (si no es válida, se responde al hilo).
   Devuelve la página del hilo en la que queda, para llevar allí al autor. */
export async function createReply(
  ctx: MemberContext,
  campaignId: string,
  value: ForumValue,
  parent: unknown,
  replyTo: unknown,
): Promise<Created> {
  const now = new Date();
  try {
    if (typeof parent !== "string" || !isValidId(parent)) return gone();
    const target = typeof replyTo === "string" && isValidId(replyTo) ? replyTo : null;
    const [root, answered] = await Promise.all([
      ForumPost.findOne({ _id: parent, campaign: ctx.campaign._id, parent: null }).select("author").lean(),
      target
        ? ForumPost.findOne({ _id: target, campaign: ctx.campaign._id, parent }).select("author").lean()
        : null,
    ]);
    if (!root) return gone();

    const reply = await ForumPost.create({
      campaign: ctx.campaign._id,
      author: ctx.session.id,
      parent: root._id,
      replyTo: answered?._id,
      content: value.content,
    });
    const [count] = await Promise.all([
      ForumPost.countDocuments({ parent: root._id }),
      ForumPost.updateOne({ _id: root._id }, { $set: { lastActivityAt: now } }),
    ]);

    // Avisa al autor del hilo y al de la respuesta contestada, si siguen en la campaña
    const memberIds = ctx.campaign.members.map(String);
    const recipients = [...new Set([String(root.author), ...(answered ? [String(answered.author)] : [])])].filter(
      (u) => u !== ctx.session.id && memberIds.includes(u),
    );
    await Promise.all(
      recipients.map((user) =>
        notify({ user, type: "forum_reply", actor: ctx.session.id, campaign: campaignId, post: String(root._id) }).catch(logError),
      ),
    );

    return { ok: true, id: String(reply._id), rootId: String(root._id), page: Math.max(1, Math.ceil(count / REPLIES_PER_PAGE)) };
  } catch (err) {
    return publishFailed(err);
  }
}

/* Edita el contenido (solo su autor) o fija/desfija un hilo (solo el DM).
   Body: { title?, content } o { pinned: boolean }. Al fijar devuelve { pinned }. */
export async function editForumPost(
  ctx: MemberContext,
  postId: string,
  body: { title?: unknown; content?: unknown; pinned?: unknown },
): Promise<Result<{ pinned?: boolean }>> {
  if (!isValidId(postId)) return gone();

  try {
    const post = await ForumPost.findOne({ _id: postId, campaign: ctx.campaign._id });
    if (!post) return gone();

    if (body.pinned !== undefined) {
      if (!ctx.isDm) return fail(403, "Solo el DM puede fijar mensajes.");
      if (post.parent) return fail(400, "Solo se pueden fijar mensajes principales.");
      post.pinned = body.pinned === true;
      await post.save();
      return { ok: true, pinned: post.pinned };
    }

    if (String(post.author) !== ctx.session.id) return fail(403, "Solo el autor puede editar el mensaje.");
    const isRoot = !post.parent;
    const { errors, value } = parseForumBody(body, isRoot);
    if (Object.keys(errors).length > 0) return invalid(errors);

    if (isRoot) post.title = value.title;
    post.content = value.content;
    post.editedAt = new Date();
    await post.save();
    return { ok: true };
  } catch (err) {
    console.error("Error al editar el mensaje del foro:", err);
    return fail(500, "No se pudo guardar el cambio. Inténtalo de nuevo.");
  }
}

// El autor o el DM. Al borrar un mensaje principal, se borran también sus respuestas y reacciones.
export async function deleteForumPost(ctx: MemberContext, postId: string): Promise<Result> {
  if (!isValidId(postId)) return gone();

  try {
    const post = await ForumPost.findOne({ _id: postId, campaign: ctx.campaign._id });
    if (!post) return gone();
    if (String(post.author) !== ctx.session.id && !ctx.isDm) return fail(403, "No puedes borrar este mensaje.");

    const ids: unknown[] = [post._id];
    if (!post.parent) {
      const replies = await ForumPost.find({ parent: post._id }).select("_id").lean();
      ids.push(...replies.map((r) => r._id));
    }
    await ForumReaction.deleteMany({ post: { $in: ids } });
    await ForumPost.deleteMany({ _id: { $in: ids } });
    // Los avisos que enlazaban a este hilo ya no llevarían a ningún sitio
    if (!post.parent) await Notification.deleteMany({ post: post._id });
    return { ok: true };
  } catch (err) {
    console.error("Error al borrar el mensaje del foro:", err);
    return fail(500, "No se pudo borrar el mensaje. Inténtalo de nuevo.");
  }
}

// Pone la reacción, o la quita si ya la tenías (`emoji` ya validado). Devuelve si queda puesta y cuántas hay.
export async function toggleReaction(
  ctx: MemberContext,
  postId: string,
  emoji: string,
): Promise<Result<{ active: boolean; count: number }>> {
  if (!isValidId(postId)) return gone();

  try {
    const post = await ForumPost.exists({ _id: postId, campaign: ctx.campaign._id });
    if (!post) return gone();

    // Si ya existía, se quita. Si no, se crea (el índice único evita duplicados aunque se pulse dos veces seguidas).
    const removed = await ForumReaction.deleteOne({ post: postId, user: ctx.session.id, emoji });
    let active = false;
    if (removed.deletedCount === 0) {
      try {
        await ForumReaction.create({ campaign: ctx.campaign._id, post: postId, user: ctx.session.id, emoji });
      } catch (err) {
        if ((err as { code?: number }).code !== 11000) throw err;
      }
      active = true;
    }
    const count = await ForumReaction.countDocuments({ post: postId, emoji });
    return { ok: true, active, count };
  } catch (err) {
    console.error("Error al reaccionar:", err);
    return fail(500, "No se pudo reaccionar. Inténtalo de nuevo.");
  }
}
