import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Message } from "@/lib/Message";
import { Notification } from "@/lib/Notification";
import { pairKey } from "@/lib/Friendship";
import { blockStatus } from "@/lib/blocks";
import { findUserByUsername, relationBetween } from "@/lib/friends";
import { notify } from "@/lib/notify";
import { cleanText } from "@/lib/utils";

type Ctx = { params: Promise<{ username: string }> };

const view = (
  m: { _id: unknown; from: unknown; text: string; createdAt: Date },
  meId: string,
) => ({
  id: String(m._id),
  mine: String(m.from) === meId,
  text: m.text,
  createdAt: new Date(m.createdAt).toISOString(),
});

/* GET: mensajes de la conversación (los últimos 50, o los posteriores a ?after=).
   Al consultarla, los mensajes recibidos pasan a leídos y su notificación desaparece.
   myLastReadId: el último mensaje TUYO que la otra persona ya ha leído (para mostrar "Leído"). */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { username } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  try {
    await connectDB();
    const other = await findUserByUsername(username);
    if (!other)
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 404 },
      );
    const otherId = String(other._id);
    const pair = pairKey(session.id, otherId);

    const afterRaw = req.nextUrl.searchParams.get("after");
    const after = afterRaw ? new Date(afterRaw) : null;
    const messages =
      after && !Number.isNaN(after.getTime())
        ? // $gte: el navegador descarta los repetidos por id, así no se pierde ninguno con la misma milésima
          await Message.find({ pair, createdAt: { $gte: after } })
            .sort({ createdAt: 1 })
            .limit(100)
            .lean()
        : (
            await Message.find({ pair })
              .sort({ createdAt: -1 })
              .limit(50)
              .lean()
          ).reverse();

    await Message.updateMany(
      { pair, to: session.id, readAt: null },
      { $set: { readAt: new Date() } },
    );
    await Notification.deleteMany({
      user: session.id,
      type: "message",
      actor: otherId,
    });

    const lastRead = await Message.findOne({
      pair,
      from: session.id,
      readAt: { $ne: null },
    })
      .sort({ createdAt: -1 })
      .select("_id")
      .lean();

    const friends = (await relationBetween(session.id, otherId)) === "friend";
    const canSend = friends && !(await blockStatus(session.id, otherId)).any;
    return NextResponse.json({
      messages: messages.map((m) => view(m, session.id)),
      canSend,
      myLastReadId: lastRead ? String(lastRead._id) : null,
    });
  } catch (err) {
    console.error("Error al cargar los mensajes:", err);
    return NextResponse.json(
      { error: "No se pudieron cargar los mensajes." },
      { status: 500 },
    );
  }
}

// POST: enviar un mensaje (solo a amigos, y sin bloqueos de por medio)
export async function POST(req: NextRequest, { params }: Ctx) {
  const { username } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("message_send", session.id, 40, 10 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  const text = cleanText(typeof body.text === "string" ? body.text : "").trim();
  if (!text)
    return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });
  if (text.length > 2000)
    return NextResponse.json(
      { error: "El mensaje es demasiado largo (máximo 2000 caracteres)." },
      { status: 400 },
    );

  try {
    await connectDB();
    const other = await findUserByUsername(username);
    if (!other)
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 404 },
      );
    const otherId = String(other._id);

    if ((await blockStatus(session.id, otherId)).any) {
      return NextResponse.json(
        { error: "No puedes enviar mensajes a este usuario." },
        { status: 403 },
      );
    }
    if ((await relationBetween(session.id, otherId)) !== "friend") {
      return NextResponse.json(
        { error: "Solo puedes escribir a tus amigos." },
        { status: 403 },
      );
    }

    const message = await Message.create({
      from: session.id,
      to: otherId,
      pair: pairKey(session.id, otherId),
      text,
    });
    await notify({ user: otherId, type: "message", actor: session.id, quote: text });
    return NextResponse.json(
      { message: view(message, session.id) },
      { status: 201 },
    );
  } catch (err) {
    console.error("Error al enviar el mensaje:", err);
    return NextResponse.json(
      { error: "No se pudo enviar el mensaje. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
