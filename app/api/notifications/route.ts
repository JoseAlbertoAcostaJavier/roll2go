import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { deleteNotifications, listNotifications } from "@/lib/server/notifications/notifications";
import { failureResponse } from "@/lib/server/result";

// GET /api/notifications?limit=10  ->  lista y contador. Con limit=0 solo devuelve el contador.
export async function GET(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(
    Math.max(raw === null ? 10 : parseInt(raw, 10) || 0, 0),
    50,
  );

  try {
    return NextResponse.json(await listNotifications(session.id, limit));
  } catch (err) {
    console.error("Error al cargar las notificaciones:", err);
    return NextResponse.json(
      { error: "No se pudieron cargar las notificaciones." },
      { status: 500 },
    );
  }
}

// DELETE { id } borra una notificación; DELETE { all: true } las borra todas
export async function DELETE(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const result = await deleteNotifications(session.id, body);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
