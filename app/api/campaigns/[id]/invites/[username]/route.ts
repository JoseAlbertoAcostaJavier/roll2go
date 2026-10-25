import { NextRequest, NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { requireDm } from "@/lib/server/campaigns/campaignApi";
import { inviteFriend } from "@/lib/server/campaigns/invites";
import { failureResponse } from "@/lib/server/result";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requireDm(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit(
    "campaign_invite",
    ctx.session.id,
    30,
    60 * 60,
  );
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { username?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const result = await inviteFriend(ctx, id, typeof body.username === "string" ? body.username : "");
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true }, { status: 201 });
}
