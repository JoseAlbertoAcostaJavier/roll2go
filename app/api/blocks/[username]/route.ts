import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { blockUser, unblockUser } from "@/lib/server/social/relations";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ username: string }> };

// PUT: bloquear a un usuario
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { username } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("block", session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const result = await blockUser(session.id, username);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ blocked: true });
}

// DELETE: desbloquear (la amistad no se restablece)
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { username } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("block", session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const result = await unblockUser(session.id, username);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ blocked: false });
}
