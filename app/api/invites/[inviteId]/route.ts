import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { CampaignInvite } from "@/lib/CampaignInvite";
import { Notification } from "@/lib/Notification";
import { joinCampaign } from "@/lib/joinCampaign";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  const { inviteId } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("invite_answer", session.id, 60, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  if (body.action !== "accept" && body.action !== "decline") {
    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  }
  const gone = () =>
    NextResponse.json(
      { error: "La invitación ya no existe." },
      { status: 404 },
    );
  if (!mongoose.isValidObjectId(inviteId)) return gone();

  try {
    await connectDB();
    // Solo se puede responder a una invitación dirigida a ti
    const invite = await CampaignInvite.findOne({
      _id: inviteId,
      user: session.id,
    });
    if (!invite) return gone();

    const clean = async () => {
      await invite.deleteOne();
      await Notification.deleteMany({
        user: session.id,
        type: "campaign_invite",
        campaign: invite.campaign,
      });
    };

    if (body.action === "decline") {
      await clean();
      return NextResponse.json({ ok: true });
    }

    const result = await joinCampaign(invite.campaign, session.id);
    if (result === "full") {
      return NextResponse.json(
        { error: "La campaña ha alcanzado el máximo de participantes." },
        { status: 409 },
      );
    }
    await clean();
    if (result === "banned" || result === "missing") return gone();
    return NextResponse.json({ id: String(invite.campaign) });
  } catch (err) {
    console.error("Error al responder a la invitación:", err);
    return NextResponse.json(
      { error: "No se pudo completar la acción. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
