import { NextRequest, NextResponse } from "next/server";
import { requireDm } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { rejectCharacter } from "@/lib/server/campaigns/characterReview";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ id: string; characterId: string }> };

// POST: el DM deniega la solicitud de un personaje, que sale de la campaña (sigue existiendo). Solo si sigue pendiente (si no, 409).
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id, characterId } = await params;
  const ctx = await requireDm(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("campaign_characters", ctx.session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const result = await rejectCharacter(ctx, id, characterId);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
