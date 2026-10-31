import { NextRequest, NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { requireMember } from "@/lib/server/campaigns/campaignApi";
import { toggleReaction } from "@/lib/server/forum/posts";
import { failureResponse } from "@/lib/server/result";
import { REACTION_EMOJIS } from "@/lib/shared/forum";

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

  const result = await toggleReaction(ctx, postId, emoji);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ active: result.active, count: result.count });
}
