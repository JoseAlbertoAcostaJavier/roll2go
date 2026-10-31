import "server-only";
// Notificaciones del usuario: la lista con su texto y enlace, marcarlas como leídas y borrarlas
import { connectDB } from "@/lib/models/mongodb";
import { Campaign } from "@/lib/models/Campaign";
import { Notification } from "@/lib/models/Notification";
import { User } from "@/lib/models/User";
import { isValidId } from "@/lib/server/ids";
import { fail, type Result } from "@/lib/server/result";
import { describeNotification, type NotificationType } from "@/lib/shared/notificationText";

// Qué notificaciones se borran: { all: true } todas; { id } una (lo que venga en el cuerpo de la petición)
type Target = { id?: unknown; all?: unknown } | null;

/* Contador de no leídas y, si `limit` > 0, las `limit` más recientes con su texto, enlace y quién la provocó.
   Con limit 0 solo devuelve el contador. */
export async function listNotifications(userId: string, limit: number) {
  await connectDB();
  const unread = await Notification.countDocuments({ user: userId, read: false });
  if (limit === 0) return { unread };

  const items = await Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).lean();
  const actorIds = [...new Set(items.filter((n) => n.actor).map((n) => String(n.actor)))];
  const campaignIds = [...new Set(items.filter((n) => n.campaign).map((n) => String(n.campaign)))];
  const [actors, campaigns] = await Promise.all([
    User.find({ _id: { $in: actorIds } }).select("username displayName avatarId").lean(),
    Campaign.find({ _id: { $in: campaignIds } }).select("name").lean(),
  ]);
  const actorById = new Map(actors.map((a) => [String(a._id), a] as const));
  const campaignById = new Map(campaigns.map((c) => [String(c._id), c] as const));

  return {
    unread,
    items: items.map((n) => {
      const a = n.actor ? actorById.get(String(n.actor)) : undefined;
      const c = n.campaign ? campaignById.get(String(n.campaign)) : undefined;
      const { text, href } = describeNotification(
        {
          type: n.type as NotificationType,
          count: n.count,
          text: n.text,
          post: n.post ? String(n.post) : undefined,
          character: n.character ? String(n.character) : undefined,
        },
        a ? { username: a.username, displayName: a.displayName || a.username } : null,
        c ? { id: String(c._id), name: c.name } : null,
      );
      return {
        id: String(n._id),
        type: n.type,
        read: n.read,
        createdAt: new Date(n.createdAt).toISOString(),
        text,
        href,
        actor: a
          ? {
              username: a.username,
              displayName: a.displayName || a.username,
              avatarUrl: a.avatarId ? `/api/images/${a.avatarId}` : null,
            }
          : null,
      };
    }),
  };
}

// Marca como leída una notificación tuya, o todas
export async function markNotificationsRead(userId: string, target: { id?: unknown; all?: unknown }): Promise<Result> {
  try {
    await connectDB();
    if (target.all === true) {
      await Notification.updateMany({ user: userId, read: false }, { $set: { read: true } });
    } else if (typeof target.id === "string" && isValidId(target.id)) {
      await Notification.updateOne({ _id: target.id, user: userId }, { $set: { read: true } });
    } else {
      return fail(400, "Petición no válida.");
    }
    return { ok: true };
  } catch (err) {
    console.error("Error al marcar como leída:", err);
    return fail(500, "No se pudo completar la acción.");
  }
}

// Borra una notificación tuya, o todas
export async function deleteNotifications(userId: string, target: Target): Promise<Result> {
  let filter: Record<string, unknown>;
  if (target?.all === true) filter = { user: userId };
  else if (typeof target?.id === "string" && isValidId(target.id)) filter = { _id: target.id, user: userId };
  else return fail(400, "Petición no válida.");

  try {
    await connectDB();
    await Notification.deleteMany(filter);
    return { ok: true };
  } catch (err) {
    console.error("Error al borrar notificaciones:", err);
    return fail(500, "No se pudo completar la acción.");
  }
}
