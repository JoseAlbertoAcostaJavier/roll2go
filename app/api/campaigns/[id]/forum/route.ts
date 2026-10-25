import { NextRequest, NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { requireMember } from "@/lib/server/campaigns/campaignApi";
import { createReply, createThread } from "@/lib/server/forum/posts";
import { failureResponse } from "@/lib/server/result";
import { parseForumBody } from "@/lib/shared/forum";

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

  // Mensaje principal (avisa a todos los demás participantes) o respuesta
  const result = isReply
    ? await createReply(ctx, id, value, body.parent, body.replyTo)
    : await createThread(ctx, id, value);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ id: result.id, rootId: result.rootId, page: result.page }, { status: 201 });
}
