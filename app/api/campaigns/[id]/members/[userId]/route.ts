import { NextRequest, NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { requireMember } from "@/lib/server/campaigns/campaignApi";
import { removeMember } from "@/lib/server/campaigns/memberActions";
import { failureResponse } from "@/lib/server/result";

/* DELETE: el DM expulsa a un jugador, o un jugador se va él mismo.
   ?ban=1 (solo el DM) añade además a la persona a la lista de bloqueados de la campaña.
   El DM no puede irse ni ser expulsado (tendría que borrar la campaña). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  const ctx = await requireMember(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("members", ctx.session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const result = await removeMember(ctx, id, userId, req.nextUrl.searchParams.get("ban") === "1");
  if (!result.ok) return failureResponse(result);
  // Sus notas se mantienen. Se devuelve cuántas son para que el DM decida si borrarlas.
  return NextResponse.json({ ok: true, notes: result.notes });
}
