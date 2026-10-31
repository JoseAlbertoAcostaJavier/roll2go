import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/server/admin/adminApi";
import { sendAnnouncement } from "@/lib/server/admin/moderation";
import { failureResponse } from "@/lib/server/result";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";

export async function POST(req: NextRequest) {
  // La comprobación del rol se hace en la base de datos, no en el token. A quien no es admin le da 404.
  const ctx = await requireAdminApi(req);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("announce", ctx.session.id, 5, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  const text = (typeof body.text === "string" ? body.text : "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim();
  if (text.length < 3 || text.length > 500) {
    return NextResponse.json(
      { error: "El aviso debe tener entre 3 y 500 caracteres." },
      { status: 400 },
    );
  }

  // Una notificación por usuario verificado
  const result = await sendAnnouncement(text);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ sent: result.sent });
}
