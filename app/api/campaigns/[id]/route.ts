import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { deleteCampaign, updateCampaign } from "@/lib/server/campaigns/manageCampaign";
import { isValidId } from "@/lib/server/ids";
import { failureResponse } from "@/lib/server/result";
type Ctx = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

// EDITAR: solo el DM (owner) puede modificar la campaña
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  if (!isValidId(id)) return notFound();

  // Máximo 30 ediciones por hora y por usuario
  const limited = await rateLimit("campaign_edit", session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const result = await updateCampaign(session.id, id, form);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ id });
}

/* BORRAR: solo el DM, y tiene que enviar el nombre exacto de la campaña.
   Se borran la campaña, su homebrew y sus imágenes. Los personajes NO se borran: se quedan sin campaña. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  if (!isValidId(id)) return notFound();

  const limited = await rateLimit("campaign_delete", session.id, 10, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { confirmName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  const confirmName =
    typeof body.confirmName === "string" ? body.confirmName.trim() : "";

  const result = await deleteCampaign(session.id, id, confirmName);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
