import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { leaveCampaign, requestJoinCampaign } from "@/lib/server/characters/campaignMembership";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ id: string }> };

/* POST { campaignId }: el dueño solicita unir su personaje a una campaña. Queda pendiente hasta que el DM lo acepte
   (si quien lo pide es el DM, se aprueba al momento). Responde { status: "pending" | "approved" }. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("campaign_characters", session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const body = await req.json().catch(() => null);
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";

  const result = await requestJoinCampaign(session.id, id, campaignId);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ status: result.status });
}

/* DELETE: el dueño saca su personaje de la campaña o cancela su solicitud. Si estaba aprobado, se avisa al DM
   (salvo que el dueño sea el propio DM). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("campaign_characters", session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const result = await leaveCampaign(session.id, id);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
