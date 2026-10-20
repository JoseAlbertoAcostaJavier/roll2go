import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Friendship, pairKey } from "@/lib/Friendship";
import { Notification } from "@/lib/Notification";
import { findUserByUsername } from "@/lib/friends";
import { notify } from "@/lib/notify";

const MAX_PENDING = 50; // solicitudes enviadas sin responder

export async function POST(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("friend_request", session.id, 20, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { username?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  try {
    await connectDB();
    const target = await findUserByUsername(
      typeof body.username === "string" ? body.username : "",
    );
    if (!target)
      return NextResponse.json(
        { error: "No existe ningún usuario con ese nombre." },
        { status: 404 },
      );
    const targetId = String(target._id);
    if (targetId === session.id) {
      return NextResponse.json(
        { error: "No puedes enviarte una solicitud a ti mismo." },
        { status: 400 },
      );
    }

    const pair = pairKey(session.id, targetId);
    const existing = await Friendship.findOne({ pair });
    if (existing) {
      if (existing.status === "accepted")
        return NextResponse.json({ error: "Ya sois amigos." }, { status: 409 });
      if (String(existing.requester) === session.id) {
        return NextResponse.json(
          { error: "Ya has enviado una solicitud a este usuario." },
          { status: 409 },
        );
      }
      // Solicitud cruzada: esa persona ya te había pedido amistad, así que se acepta
      existing.status = "accepted";
      await existing.save();
      await Notification.deleteMany({
        user: session.id,
        type: "friend_request",
        actor: targetId,
      });
      await notify({
        user: targetId,
        type: "friend_accepted",
        actor: session.id,
      });
      return NextResponse.json({ relation: "friend" });
    }

    if (
      (await Friendship.countDocuments({
        requester: session.id,
        status: "pending",
      })) >= MAX_PENDING
    ) {
      return NextResponse.json(
        {
          error:
            "Tienes demasiadas solicitudes pendientes. Espera a que respondan.",
        },
        { status: 400 },
      );
    }

    await Friendship.create({
      requester: session.id,
      recipient: targetId,
      pair,
    });
    await notify({ user: targetId, type: "friend_request", actor: session.id });
    return NextResponse.json({ relation: "outgoing" }, { status: 201 });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: "Ya existe una solicitud con este usuario." },
        { status: 409 },
      );
    }
    console.error("Error al enviar la solicitud:", err);
    return NextResponse.json(
      { error: "No se pudo enviar la solicitud. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
