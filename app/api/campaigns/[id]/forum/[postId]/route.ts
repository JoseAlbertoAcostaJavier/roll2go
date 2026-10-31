import { NextRequest, NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { requireMember } from "@/lib/server/campaigns/campaignApi";
import { deleteForumPost, editForumPost } from "@/lib/server/forum/posts";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ id: string; postId: string }> };

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

  const result = await editForumPost(ctx, postId, body);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json(result.pinned === undefined ? { ok: true } : { pinned: result.pinned });
}

// DELETE: el autor o el DM. Al borrar un mensaje principal, se borran también sus respuestas y reacciones.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id, postId } = await params;
  const ctx = await requireMember(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("forum_delete", ctx.session.id, 60, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const result = await deleteForumPost(ctx, postId);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
