import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Campaign } from "@/lib/Campaign";
import { sessionOf } from "@/lib/campaignApi";
import { INVITE_REGEX, MAX_MEMBERS } from "@/lib/members";

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
    const now = new Date();
    // Enlace vigente: sin caducidad, o con una fecha todavía en el futuro
    const campaign = await Campaign.findOne({
      inviteCode: code,
      $or: [
        { inviteExpires: { $exists: false } },
        { inviteExpires: { $gt: now } },
      ],
    }).select("members");
    if (!campaign) return invalid();

    const id = String(campaign._id);
    if (campaign.members.some((m: unknown) => String(m) === session.id)) {
      return NextResponse.json({ id, already: true });
    }

    // Operación atómica: solo añade si todavía hay hueco (el elemento nº MAX_MEMBERS no existe)
    const updated = await Campaign.findOneAndUpdate(
      { _id: campaign._id, [`members.${MAX_MEMBERS - 1}`]: { $exists: false } },
      { $addToSet: { members: session.id } },
    );
    if (!updated) {
      return NextResponse.json(
        { error: "La campaña ha alcanzado el máximo de participantes." },
        { status: 409 },
      );
    }
    return NextResponse.json({ id });
  } catch (err) {
    console.error("Error al unirse a la campaña:", err);
    return NextResponse.json(
      { error: "No se pudo completar la unión. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
