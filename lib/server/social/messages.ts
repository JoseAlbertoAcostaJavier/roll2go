import "server-only";
// Mensajes privados entre amigos: la lista de conversaciones, una conversación y enviar un mensaje
import mongoose from "mongoose";
import { connectDB } from "@/lib/models/mongodb";
import { pairKey } from "@/lib/models/Friendship";
import { Message } from "@/lib/models/Message";
import { Notification } from "@/lib/models/Notification";
import { User } from "@/lib/models/User";
import { notify } from "@/lib/server/notifications/notify";
import { fail, type Result } from "@/lib/server/result";
import { blockStatus } from "@/lib/server/social/blocks";
import { findUserByUsername, relationBetween } from "@/lib/server/social/friends";

// Un mensaje tal como lo pinta la conversación
export type ChatMessageView = { id: string; mine: boolean; text: string; createdAt: string };

const view = (m: { _id: unknown; from: unknown; text: string; createdAt: Date }, meId: string): ChatMessageView => ({
  id: String(m._id),
  mine: String(m.from) === meId,
  text: m.text,
  createdAt: new Date(m.createdAt).toISOString(),
});

// Solo se escribe a amigos y sin bloqueos de por medio
async function canWrite(meId: string, otherId: string) {
  const friends = (await relationBetween(meId, otherId)) === "friend";
  return friends && !(await blockStatus(meId, otherId)).any;
}

// El último mensaje TUYO que la otra persona ya ha leído (para mostrar "Leído")
async function lastReadId(pair: string, meId: string) {
  const lastRead = await Message.findOne({ pair, from: meId, readAt: { $ne: null } })
    .sort({ createdAt: -1 })
    .select("_id")
    .lean();
  return lastRead ? String(lastRead._id) : null;
}

/* Conversaciones de la página de mensajes: la última con cada persona (como mucho 50, la más reciente primero), con
   el principio del último mensaje y cuántos tienes sin leer. Las cuentas borradas no aparecen, pero cuentan en
   `total` (con alguna conversación no se muestra el aviso de que no hay ninguna). */
export async function listConversations(meId: string) {
  await connectDB();
  const me = new mongoose.Types.ObjectId(meId);
  const rows = await Message.aggregate([
    { $match: { $or: [{ from: me }, { to: me }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$pair",
        last: { $first: "$$ROOT" },
        unread: { $sum: { $cond: [{ $and: [{ $eq: ["$to", me] }, { $eq: ["$readAt", null] }] }, 1, 0] } },
      },
    },
    { $sort: { "last.createdAt": -1 } },
    { $limit: 50 },
  ]);

  const otherIds = rows.map((r) => (String(r.last.from) === meId ? String(r.last.to) : String(r.last.from)));
  const users = await User.find({ _id: { $in: otherIds } }).select("username displayName avatarId").lean();
  const byId = new Map(users.map((u) => [String(u._id), u] as const));

  const conversations = rows.flatMap((r, i) => {
    const u = byId.get(otherIds[i]);
    if (!u) return []; // cuenta borrada
    return [
      {
        pair: String(r._id),
        username: u.username as string,
        displayName: (u.displayName || u.username) as string,
        avatarUrl: u.avatarId ? `/api/images/${u.avatarId}` : null,
        mine: String(r.last.from) === meId,
        preview: String(r.last.text).slice(0, 90),
        unread: r.unread as number,
      },
    ];
  });
  return { total: rows.length, conversations };
}

/* Página de una conversación: la otra persona, los últimos 50 mensajes y si puedes escribir. "missing" si no existe;
   "self" si eres tú; "nothing" si no podéis escribiros y no hay historial. */
export async function loadConversationPage(meId: string, username: string) {
  await connectDB();
  const other = await findUserByUsername(username);
  if (!other) return { status: "missing" as const };
  const otherId = String(other._id);
  if (otherId === meId) return { status: "self" as const };

  const canSend = await canWrite(meId, otherId);
  const pair = pairKey(meId, otherId);
  const recent = await Message.find({ pair }).sort({ createdAt: -1 }).limit(50).lean();
  if (!canSend && recent.length === 0) return { status: "nothing" as const, username: other.username as string };

  const messages = recent.reverse().map((m) => view(m, meId));
  return {
    status: "ok" as const,
    other: {
      username: other.username as string,
      displayName: (other.displayName || other.username) as string,
      avatarUrl: other.avatarId ? `/api/images/${other.avatarId}` : null,
    },
    messages,
    lastReadId: await lastReadId(pair, meId),
    canSend,
  };
}

/* Mensajes de la conversación (los últimos 50, o los posteriores a `afterRaw`). Al consultarla, los mensajes recibidos
   pasan a leídos y su notificación desaparece. */
export async function loadConversation(
  meId: string,
  username: string,
  afterRaw: string | null,
): Promise<Result<{ messages: ChatMessageView[]; canSend: boolean; myLastReadId: string | null }>> {
  try {
    await connectDB();
    const other = await findUserByUsername(username);
    if (!other) return fail(404, "Usuario no encontrado.");
    const otherId = String(other._id);
    const pair = pairKey(meId, otherId);

    const after = afterRaw ? new Date(afterRaw) : null;
    const messages =
      after && !Number.isNaN(after.getTime())
        ? // $gte: el navegador descarta los repetidos por id, así no se pierde ninguno con la misma milésima
          await Message.find({ pair, createdAt: { $gte: after } }).sort({ createdAt: 1 }).limit(100).lean()
        : (await Message.find({ pair }).sort({ createdAt: -1 }).limit(50).lean()).reverse();

    await Message.updateMany({ pair, to: meId, readAt: null }, { $set: { readAt: new Date() } });
    await Notification.deleteMany({ user: meId, type: "message", actor: otherId });

    const myLastReadId = await lastReadId(pair, meId);
    const canSend = await canWrite(meId, otherId);
    return { ok: true, messages: messages.map((m) => view(m, meId)), canSend, myLastReadId };
  } catch (err) {
    console.error("Error al cargar los mensajes:", err);
    return fail(500, "No se pudieron cargar los mensajes.");
  }
}

// Envía un mensaje (ya limpio) a un amigo y le avisa
export async function sendMessage(meId: string, username: string, text: string): Promise<Result<{ message: ChatMessageView }>> {
  try {
    await connectDB();
    const other = await findUserByUsername(username);
    if (!other) return fail(404, "Usuario no encontrado.");
    const otherId = String(other._id);

    if ((await blockStatus(meId, otherId)).any) return fail(403, "No puedes enviar mensajes a este usuario.");
    if ((await relationBetween(meId, otherId)) !== "friend") return fail(403, "Solo puedes escribir a tus amigos.");

    const message = await Message.create({ from: meId, to: otherId, pair: pairKey(meId, otherId), text });
    await notify({ user: otherId, type: "message", actor: meId, quote: text });
    return { ok: true, message: view(message, meId) };
  } catch (err) {
    console.error("Error al enviar el mensaje:", err);
    return fail(500, "No se pudo enviar el mensaje. Inténtalo de nuevo.");
  }
}
