import { NextRequest, NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { requireDm } from "@/lib/server/campaigns/campaignApi";
import { deleteMemberNotes } from "@/lib/server/campaigns/memberActions";
import { failureResponse } from "@/lib/server/result";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  const ctx = await requireDm(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("members", ctx.session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  // Solo para quien ya no está en la campaña: las notas de un participante activo se borran una a una
  const result = await deleteMemberNotes(ctx, userId);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ deleted: result.deleted });
}
