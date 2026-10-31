import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { markNotificationsRead } from "@/lib/server/notifications/notifications";
import { failureResponse } from "@/lib/server/result";

// POST { id } marca una como leída; POST { all: true } marca todas
export async function POST(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  let body: { id?: unknown; all?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const result = await markNotificationsRead(session.id, body);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
