import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { sendFriendRequest } from "@/lib/server/social/relations";
import { failureResponse } from "@/lib/server/result";

export async function POST(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("friend_request", session.id, 20, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { username?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const result = await sendFriendRequest(session.id, typeof body.username === "string" ? body.username : "");
  if (!result.ok) return failureResponse(result);
  // Solicitud cruzada: ya sois amigos. Si no, la solicitud queda creada.
  if (result.relation === "friend") return NextResponse.json({ relation: "friend" });
  return NextResponse.json({ relation: "outgoing" }, { status: 201 });
}
