import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { searchUsers } from "@/lib/server/social/queries";
import { failureResponse } from "@/lib/server/result";
export async function GET(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  // Se consulta mientras se escribe: límite de 60 búsquedas por minuto
  const limited = await rateLimit("user_search", session.id, 60, 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const q = (req.nextUrl.searchParams.get("q") ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 20);
  if (q.length < 2) return NextResponse.json({ users: [] });

  // Solo por usuario y nombre visible, y solo por el principio (nunca por correo)
  const result = await searchUsers(session.id, q);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ users: result.users });
}
