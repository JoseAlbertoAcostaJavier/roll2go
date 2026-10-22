import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { ForumPost } from "@/lib/ForumPost";
import { ForumReaction } from "@/lib/ForumReaction";
import { requireMember } from "@/lib/campaignApi";
import { REACTION_EMOJIS } from "@/lib/forum";

// POST { emoji }: pone la reacción, o la quita si ya la tenías. Devuelve { active, count }.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params;
  const ctx = await requireMember(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("forum_react", ctx.session.id, 150, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { emoji?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  const emoji = typeof body.emoji === "string" ? body.emoji : "";
  if (!REACTION_EMOJIS.includes(emoji)) return NextResponse.json({ error: "Reacción no válida." }, { status: 400 });
  if (!mongoose.isValidObjectId(postId)) return NextResponse.json({ error: "El mensaje ya no existe." }, { status: 404 });

  try {
    const post = await ForumPost.exists({ _id: postId, campaign: ctx.campaign._id });
    if (!post) return NextResponse.json({ error: "El mensaje ya no existe." }, { status: 404 });

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
    return NextResponse.json({ active, count });
  } catch (err) {
    console.error("Error al reaccionar:", err);
    return NextResponse.json({ error: "No se pudo reaccionar. Inténtalo de nuevo." }, { status: 500 });
  }
}