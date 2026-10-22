import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { ForumPost } from "@/lib/ForumPost";
import { ForumReaction } from "@/lib/ForumReaction";
import { Notification } from "@/lib/Notification";
import { requireMember } from "@/lib/campaignApi";
import { parseForumBody } from "@/lib/forum";

type Ctx = { params: Promise<{ id: string; postId: string }> };

const gone = () => NextResponse.json({ error: "El mensaje ya no existe." }, { status: 404 });

/* PATCH: editar el contenido (solo su autor) o fijar/desfijar un hilo (solo el DM).
   Body: { title?, content } o { pinned: boolean } */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id, postId } = await params;
  const ctx = await requireMember(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("forum_edit", ctx.session.id, 60, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { title?: unknown; content?: unknown; pinned?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  if (!mongoose.isValidObjectId(postId)) return gone();

  try {
    const post = await ForumPost.findOne({ _id: postId, campaign: ctx.campaign._id });
    if (!post) return gone();

    if (body.pinned !== undefined) {
      if (!ctx.isDm) return NextResponse.json({ error: "Solo el DM puede fijar mensajes." }, { status: 403 });
      if (post.parent) return NextResponse.json({ error: "Solo se pueden fijar mensajes principales." }, { status: 400 });
      post.pinned = body.pinned === true;
      await post.save();
      return NextResponse.json({ pinned: post.pinned });
    }

    if (String(post.author) !== ctx.session.id) {
      return NextResponse.json({ error: "Solo el autor puede editar el mensaje." }, { status: 403 });
    }
    const isRoot = !post.parent;
    const { errors, value } = parseForumBody(body, isRoot);
    if (Object.keys(errors).length > 0) return NextResponse.json({ errors }, { status: 400 });

    if (isRoot) post.title = value.title;
    post.content = value.content;
    post.editedAt = new Date();
    await post.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al editar el mensaje del foro:", err);
    return NextResponse.json({ error: "No se pudo guardar el cambio. Inténtalo de nuevo." }, { status: 500 });
  }
}

// DELETE: el autor o el DM. Al borrar un mensaje principal, se borran también sus respuestas y reacciones.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id, postId } = await params;
  const ctx = await requireMember(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("forum_delete", ctx.session.id, 60, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);
  if (!mongoose.isValidObjectId(postId)) return gone();

  try {
    const post = await ForumPost.findOne({ _id: postId, campaign: ctx.campaign._id });
    if (!post) return gone();
    if (String(post.author) !== ctx.session.id && !ctx.isDm) {
      return NextResponse.json({ error: "No puedes borrar este mensaje." }, { status: 403 });
    }

    const ids: unknown[] = [post._id];
    if (!post.parent) {
      const replies = await ForumPost.find({ parent: post._id }).select("_id").lean();
      ids.push(...replies.map((r) => r._id));
    }
    await ForumReaction.deleteMany({ post: { $in: ids } });
    await ForumPost.deleteMany({ _id: { $in: ids } });
    // Los avisos que enlazaban a este hilo ya no llevarían a ningún sitio
    if (!post.parent) await Notification.deleteMany({ post: post._id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al borrar el mensaje del foro:", err);
    return NextResponse.json({ error: "No se pudo borrar el mensaje. Inténtalo de nuevo." }, { status: 500 });
  }
}