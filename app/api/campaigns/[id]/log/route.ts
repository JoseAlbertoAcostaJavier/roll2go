import { NextRequest, NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { CampaignLogEntry } from "@/lib/CampaignLogEntry";
import { requireMember } from "@/lib/campaignApi";
import { parseLogBody } from "@/lib/logInput";
import { notify } from "@/lib/notify";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requireMember(req, id); // cualquier miembro puede escribir notas
  if (ctx.error) return ctx.error;

  // Máximo 30 notas por hora y por usuario
  const limited = await rateLimit("log_create", ctx.session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { title?: unknown; content?: unknown; visibility?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const { errors, value } = parseLogBody(body);
  if (Object.keys(errors).length > 0)
    return NextResponse.json({ errors }, { status: 400 });

  try {
    const entry = await CampaignLogEntry.create({
      campaign: ctx.campaign._id,
      author: ctx.session.id,
      ...value,
    });
    // Las notas públicas avisan al resto de participantes. Las privadas no avisan a nadie.
    if (value.visibility === "public") {
      const others = ctx.campaign.members
        .map(String)
        .filter((m) => m !== ctx.session.id);
      await Promise.all(
        others.map((user) =>
          notify({
            user,
            type: "campaign_note",
            actor: ctx.session.id,
            campaign: id,
          }).catch((err) =>
            console.error("No se pudo avisar de la nota:", err),
          ),
        ),
      );
    }
    return NextResponse.json({ id: String(entry._id) }, { status: 201 });
  } catch (err) {
    console.error("Error al crear la nota:", err);
    return NextResponse.json(
      { error: "No se pudo guardar la nota. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
