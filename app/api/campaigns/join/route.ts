import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Campaign } from "@/lib/Campaign";
import { Block } from "@/lib/Block";
import { sessionOf } from "@/lib/campaignApi";
import { INVITE_REGEX } from "@/lib/members";
import { joinCampaign } from "@/lib/joinCampaign";

export async function POST(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json(
      { error: "Inicia sesión para unirte." },
      { status: 401 },
    );

  // Máximo 20 intentos por hora y por usuario (frena probar códigos al azar)
  const limited = await rateLimit("join", session.id, 20, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  const invalid = () =>
    NextResponse.json(
      { error: "El enlace no es válido o ha caducado." },
      { status: 404 },
    );

  const code = typeof body.code === "string" ? body.code : "";
  if (!INVITE_REGEX.test(code)) return invalid();

  try {
    await connectDB();
    const campaign = await Campaign.findOne({
      inviteCode: code,
      $or: [
        { inviteExpires: { $exists: false } },
        { inviteExpires: { $gt: new Date() } },
      ],
    }).select("owner");
    if (!campaign) return invalid();

    // Quien ha sido bloqueado por el DM recibe el mismo mensaje que con un enlace caducado
    if (await Block.exists({ blocker: campaign.owner, blocked: session.id }))
      return invalid();

    const result = await joinCampaign(campaign._id, session.id);
    if (result === "banned" || result === "missing") return invalid();
    if (result === "full") {
      return NextResponse.json(
        { error: "La campaña ha alcanzado el máximo de participantes." },
        { status: 409 },
      );
    }
    return NextResponse.json({
      id: String(campaign._id),
      already: result === "already",
    });
  } catch (err) {
    console.error("Error al unirse a la campaña:", err);
    return NextResponse.json(
      { error: "No se pudo completar la unión. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
