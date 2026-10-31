import { NextRequest, NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { requireDm } from "@/lib/server/campaigns/campaignApi";
import { cancelInvite } from "@/lib/server/campaigns/invites";
import { failureResponse } from "@/lib/server/result";

// Cancela la invitación pendiente a un usuario (solo el DM)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; username: string }> },
) {
  const { id, username } = await params;
  const ctx = await requireDm(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("campaign_invite", ctx.session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const result = await cancelInvite(ctx, username);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
