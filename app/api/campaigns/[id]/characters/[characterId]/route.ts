import { NextRequest, NextResponse } from "next/server";
import { requireDm } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { removeCampaignCharacter } from "@/lib/server/campaigns/characterReview";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ id: string; characterId: string }> };

// DELETE: el DM saca un personaje (aprobado o pendiente) de la campaña. El personaje sigue existiendo para su dueño.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id, characterId } = await params;
  const ctx = await requireDm(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("campaign_characters", ctx.session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const result = await removeCampaignCharacter(ctx, id, characterId);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
