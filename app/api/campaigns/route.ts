import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/server/auth/auth";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { createCampaign } from "@/lib/server/campaigns/manageCampaign";
import { failureResponse } from "@/lib/server/result";

export async function POST(req: NextRequest) {
  // La sesión se comprueba aquí: no basta con que la página esté protegida
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json(
      { error: "Inicia sesión para crear una campaña." },
      { status: 401 },
    );
  }

  // Máximo 10 campañas por hora y por usuario
  const limited = await rateLimit("campaign_create", session.id, 10, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const result = await createCampaign(session.id, form);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ id: result.id }, { status: 201 });
}
