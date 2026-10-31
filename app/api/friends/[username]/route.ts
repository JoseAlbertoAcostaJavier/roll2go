import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { answerFriendRequest, removeFriend } from "@/lib/server/social/relations";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ username: string }> };

// PATCH: aceptar o rechazar una solicitud recibida
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { username } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("friend_answer", session.id, 60, 60 * 60);
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

  const result = await answerFriendRequest(session.id, username, body.action);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ relation: result.relation });
}

// DELETE: cancelar una solicitud enviada, o eliminar a un amigo
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { username } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("friend_remove", session.id, 60, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const result = await removeFriend(session.id, username);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ relation: result.relation });
}
