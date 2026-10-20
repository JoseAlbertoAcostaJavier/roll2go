import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Friendship, pairKey } from "@/lib/Friendship";
import { Notification } from "@/lib/Notification";
import { findUserByUsername } from "@/lib/friends";
import { notify } from "@/lib/notify";

type Ctx = { params: Promise<{ username: string }> };

// PATCH: aceptar o rechazar una solicitud recibida
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { username } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("friend_answer", session.id, 60, 60 * 60);
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

  try {
    await connectDB();
    const other = await findUserByUsername(username);
    if (!other)
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 404 },
      );
    const otherId = String(other._id);

    // Solo se puede responder a una solicitud pendiente que te hayan enviado a ti
    const f = await Friendship.findOne({
      pair: pairKey(session.id, otherId),
      status: "pending",
      recipient: session.id,
    });
    if (!f)
      return NextResponse.json(
        { error: "No hay ninguna solicitud pendiente de este usuario." },
        { status: 404 },
      );

    await Notification.deleteMany({
      user: session.id,
      type: "friend_request",
      actor: otherId,
    });
    if (body.action === "accept") {
      f.status = "accepted";
      await f.save();
      await notify({
        user: otherId,
        type: "friend_accepted",
        actor: session.id,
      });
      return NextResponse.json({ relation: "friend" });
    }
    await f.deleteOne();
    return NextResponse.json({ relation: "none" });
  } catch (err) {
    console.error("Error al responder la solicitud:", err);
    return NextResponse.json(
      { error: "No se pudo completar la acción. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}

// DELETE: cancelar una solicitud enviada, o eliminar a un amigo
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { username } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("friend_remove", session.id, 60, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  try {
    await connectDB();
    const other = await findUserByUsername(username);
    if (!other)
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 404 },
      );
    const otherId = String(other._id);

    const result = await Friendship.deleteOne({
      pair: pairKey(session.id, otherId),
    });
    if (result.deletedCount === 0)
      return NextResponse.json(
        { error: "No hay ninguna relación con este usuario." },
        { status: 404 },
      );

    // Una solicitud cancelada desaparece también de las notificaciones del otro usuario
    await Notification.deleteMany({
      type: "friend_request",
      $or: [
        { user: session.id, actor: otherId },
        { user: otherId, actor: session.id },
      ],
    });
    return NextResponse.json({ relation: "none" });
  } catch (err) {
    console.error("Error al eliminar la amistad:", err);
    return NextResponse.json(
      { error: "No se pudo completar la acción. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
