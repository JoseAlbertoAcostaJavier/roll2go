import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Block } from "@/lib/Block";
import { Friendship, pairKey } from "@/lib/Friendship";
import { Notification } from "@/lib/Notification";
import { CampaignInvite } from "@/lib/CampaignInvite";
import { findUserByUsername } from "@/lib/friends";

type Ctx = { params: Promise<{ username: string }> };

// PUT: bloquear a un usuario
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { username } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("block", session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  try {
    await connectDB();
    const target = await findUserByUsername(username);
    if (!target)
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 404 },
      );
    const targetId = String(target._id);
    if (targetId === session.id)
      return NextResponse.json(
        { error: "No puedes bloquearte a ti mismo." },
        { status: 400 },
      );

    try {
      await Block.create({ blocker: session.id, blocked: targetId });
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err; // ya estaba bloqueado: no pasa nada
    }

    // Bloquear rompe la amistad, cancela solicitudes e invitaciones y borra los avisos entre los dos
    await Friendship.deleteOne({ pair: pairKey(session.id, targetId) });
    await CampaignInvite.deleteMany({
      $or: [
        { user: session.id, invitedBy: targetId },
        { user: targetId, invitedBy: session.id },
      ],
    });
    await Notification.deleteMany({
      type: {
        $in: [
          "friend_request",
          "friend_accepted",
          "message",
          "campaign_invite",
        ],
      },
      $or: [
        { user: session.id, actor: targetId },
        { user: targetId, actor: session.id },
      ],
    });
    return NextResponse.json({ blocked: true });
  } catch (err) {
    console.error("Error al bloquear:", err);
    return NextResponse.json(
      { error: "No se pudo bloquear. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}

// DELETE: desbloquear (la amistad no se restablece)
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { username } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("block", session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  try {
    await connectDB();
    const target = await findUserByUsername(username);
    if (!target)
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 404 },
      );
    await Block.deleteOne({ blocker: session.id, blocked: target._id });
    return NextResponse.json({ blocked: false });
  } catch (err) {
    console.error("Error al desbloquear:", err);
    return NextResponse.json(
      { error: "No se pudo desbloquear. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
