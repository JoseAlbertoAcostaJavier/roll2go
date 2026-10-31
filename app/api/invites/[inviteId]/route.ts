import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { answerInvite } from "@/lib/server/campaigns/joinCampaign";
import { failureResponse } from "@/lib/server/result";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  const { inviteId } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("invite_answer", session.id, 60, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  if (body.action !== "accept" && body.action !== "decline") {
    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  }

  // Solo se puede responder a una invitación dirigida a ti
  const result = await answerInvite(session.id, inviteId, body.action);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json(result.campaignId ? { id: result.campaignId } : { ok: true });
}
