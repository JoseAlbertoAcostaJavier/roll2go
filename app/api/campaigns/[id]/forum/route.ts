import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { ForumPost } from "@/lib/ForumPost";
import { requireMember } from "@/lib/campaignApi";
import { REPLIES_PER_PAGE, parseForumBody } from "@/lib/forum";
import { notify } from "@/lib/notify";

const logError = (err: unknown) => console.error("No se pudo enviar el aviso del foro:", err);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMember(req, id); // cualquier participante puede escribir
  if (ctx.error) return ctx.error;

  // Máximo 40 mensajes o respuestas por hora y por usuario
  const limited = await rateLimit("forum_post", ctx.session.id, 40, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { title?: unknown; content?: unknown; parent?: unknown; replyTo?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const isReply = body.parent !== undefined && body.parent !== null;
  const { errors, value } = parseForumBody(body, !isReply);
  if (Object.keys(errors).length > 0) return NextResponse.json({ errors }, { status: 400 });

  try {
    const memberIds = ctx.campaign.members.map(String);
    const now = new Date();

    // MENSAJE PRINCIPAL: avisa a todos los demás participantes
    if (!isReply) {
      const post = await ForumPost.create({
        campaign: ctx.campaign._id,
        author: ctx.session.id,
        title: value.title,
        content: value.content,
        lastActivityAt: now,
      });
      const others = memberIds.filter((m) => m !== ctx.session.id);
      await Promise.all(
        others.map((user) =>
          notify({ user, type: "campaign_post", actor: ctx.session.id, campaign: id, post: String(post._id) }).catch(logError),
        ),
      );
      return NextResponse.json({ id: String(post._id), rootId: String(post._id), page: 1 }, { status: 201 });
    }

    // RESPUESTA
    const gone = () => NextResponse.json({ error: "El mensaje ya no existe." }, { status: 404 });
    if (typeof body.parent !== "string" || !mongoose.isValidObjectId(body.parent)) return gone();

    // Respuesta dirigida a otra respuesta concreta del mismo hilo (si no es válida, se responde al hilo)
    const replyTo = typeof body.replyTo === "string" && mongoose.isValidObjectId(body.replyTo) ? body.replyTo : null;
    const [root, target] = await Promise.all([
      ForumPost.findOne({ _id: body.parent, campaign: ctx.campaign._id, parent: null }).select("author").lean(),
      replyTo
        ? ForumPost.findOne({ _id: replyTo, campaign: ctx.campaign._id, parent: body.parent }).select("author").lean()
        : null,
    ]);
    if (!root) return gone();

    const reply = await ForumPost.create({
      campaign: ctx.campaign._id,
      author: ctx.session.id,
      parent: root._id,
      replyTo: target?._id,
      content: value.content,
    });
    // Página del hilo en la que queda la respuesta nueva (para llevar allí al autor)
    const [count] = await Promise.all([
      ForumPost.countDocuments({ parent: root._id }),
      ForumPost.updateOne({ _id: root._id }, { $set: { lastActivityAt: now } }),
    ]);

    // Avisa al autor del hilo y al de la respuesta contestada, si siguen en la campaña
    const recipients = [...new Set([String(root.author), ...(target ? [String(target.author)] : [])])].filter(
      (u) => u !== ctx.session.id && memberIds.includes(u),
    );
    await Promise.all(
      recipients.map((user) =>
        notify({ user, type: "forum_reply", actor: ctx.session.id, campaign: id, post: String(root._id) }).catch(logError),
      ),
    );

    return NextResponse.json(
      { id: String(reply._id), rootId: String(root._id), page: Math.max(1, Math.ceil(count / REPLIES_PER_PAGE)) },
      { status: 201 },
    );
  } catch (err) {
    console.error("Error al publicar en el foro:", err);
    return NextResponse.json({ error: "No se pudo publicar. Inténtalo de nuevo." }, { status: 500 });
  }
}