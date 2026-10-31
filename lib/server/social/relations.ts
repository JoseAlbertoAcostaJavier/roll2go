import "server-only";
// Amistades y bloqueos entre dos usuarios: enviar, aceptar, rechazar o cancelar solicitudes, eliminar a un amigo,
// bloquear y desbloquear. `meId` es quien lo pide (sesión); `username`, la otra persona.
import { connectDB } from "@/lib/models/mongodb";
import { Block } from "@/lib/models/Block";
import { CampaignInvite } from "@/lib/models/CampaignInvite";
import { Friendship, pairKey } from "@/lib/models/Friendship";
import { Notification } from "@/lib/models/Notification";
import { notify } from "@/lib/server/notifications/notify";
import { fail, type Result } from "@/lib/server/result";
import { blockStatus } from "@/lib/server/social/blocks";
import { findUserByUsername, type Relation } from "@/lib/server/social/friends";

const MAX_PENDING = 50; // solicitudes enviadas sin responder
const unknownUser = () => fail(404, "Usuario no encontrado.");
const failed = (err: unknown, log: string, error: string) => {
  console.error(log, err);
  return fail(500, error);
};

/* Solicitud de amistad. Si esa persona ya te la había enviado, se acepta ("friend"); si no, queda pendiente
   ("outgoing") y se le avisa. */
export async function sendFriendRequest(
  meId: string,
  username: string,
): Promise<Result<{ relation: "friend" | "outgoing" }>> {
  try {
    await connectDB();
    const target = await findUserByUsername(username);
    if (!target) return fail(404, "No existe ningún usuario con ese nombre.");
    const targetId = String(target._id);
    if (targetId === meId) return fail(400, "No puedes enviarte una solicitud a ti mismo.");
    // Nadie puede enviar una solicitud a quien le ha bloqueado, ni a quien ha bloqueado él
    const block = await blockStatus(meId, targetId);
    if (block.byMe) return fail(403, "Has bloqueado a este usuario. Desbloquéalo para poder enviarle una solicitud.");
    if (block.byThem) return fail(403, "No puedes enviar una solicitud a este usuario.");

    const pair = pairKey(meId, targetId);
    const existing = await Friendship.findOne({ pair });
    if (existing) {
      if (existing.status === "accepted") return fail(409, "Ya sois amigos.");
      if (String(existing.requester) === meId) return fail(409, "Ya has enviado una solicitud a este usuario.");
      // Solicitud cruzada: esa persona ya te había pedido amistad, así que se acepta
      existing.status = "accepted";
      await existing.save();
      await Notification.deleteMany({ user: meId, type: "friend_request", actor: targetId });
      await notify({ user: targetId, type: "friend_accepted", actor: meId });
      return { ok: true, relation: "friend" };
    }

    if ((await Friendship.countDocuments({ requester: meId, status: "pending" })) >= MAX_PENDING) {
      return fail(400, "Tienes demasiadas solicitudes pendientes. Espera a que respondan.");
    }

    await Friendship.create({ requester: meId, recipient: targetId, pair });
    await notify({ user: targetId, type: "friend_request", actor: meId });
    return { ok: true, relation: "outgoing" };
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return fail(409, "Ya existe una solicitud con este usuario.");
    return failed(err, "Error al enviar la solicitud:", "No se pudo enviar la solicitud. Inténtalo de nuevo.");
  }
}

// Aceptar o rechazar una solicitud pendiente que te hayan enviado a ti. Su aviso desaparece en los dos casos.
export async function answerFriendRequest(
  meId: string,
  username: string,
  action: "accept" | "decline",
): Promise<Result<{ relation: Relation }>> {
  try {
    await connectDB();
    const other = await findUserByUsername(username);
    if (!other) return unknownUser();
    const otherId = String(other._id);

    const f = await Friendship.findOne({ pair: pairKey(meId, otherId), status: "pending", recipient: meId });
    if (!f) return fail(404, "No hay ninguna solicitud pendiente de este usuario.");

    await Notification.deleteMany({ user: meId, type: "friend_request", actor: otherId });
    if (action === "accept") {
      f.status = "accepted";
      await f.save();
      await notify({ user: otherId, type: "friend_accepted", actor: meId });
      return { ok: true, relation: "friend" };
    }
    await f.deleteOne();
    return { ok: true, relation: "none" };
  } catch (err) {
    return failed(err, "Error al responder la solicitud:", "No se pudo completar la acción. Inténtalo de nuevo.");
  }
}

// Cancelar una solicitud enviada, o eliminar a un amigo
export async function removeFriend(meId: string, username: string): Promise<Result<{ relation: "none" }>> {
  try {
    await connectDB();
    const other = await findUserByUsername(username);
    if (!other) return unknownUser();
    const otherId = String(other._id);

    const result = await Friendship.deleteOne({ pair: pairKey(meId, otherId) });
    if (result.deletedCount === 0) return fail(404, "No hay ninguna relación con este usuario.");

    // Una solicitud cancelada desaparece también de las notificaciones del otro usuario
    await Notification.deleteMany({
      type: "friend_request",
      $or: [
        { user: meId, actor: otherId },
        { user: otherId, actor: meId },
      ],
    });
    return { ok: true, relation: "none" };
  } catch (err) {
    return failed(err, "Error al eliminar la amistad:", "No se pudo completar la acción. Inténtalo de nuevo.");
  }
}

// Bloquear rompe la amistad, cancela solicitudes e invitaciones y borra los avisos entre los dos
export async function blockUser(meId: string, username: string): Promise<Result> {
  try {
    await connectDB();
    const target = await findUserByUsername(username);
    if (!target) return unknownUser();
    const targetId = String(target._id);
    if (targetId === meId) return fail(400, "No puedes bloquearte a ti mismo.");

    try {
      await Block.create({ blocker: meId, blocked: targetId });
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err; // ya estaba bloqueado: no pasa nada
    }

    await Friendship.deleteOne({ pair: pairKey(meId, targetId) });
    await CampaignInvite.deleteMany({
      $or: [
        { user: meId, invitedBy: targetId },
        { user: targetId, invitedBy: meId },
      ],
    });
    await Notification.deleteMany({
      type: { $in: ["friend_request", "friend_accepted", "message", "campaign_invite"] },
      $or: [
        { user: meId, actor: targetId },
        { user: targetId, actor: meId },
      ],
    });
    return { ok: true };
  } catch (err) {
    return failed(err, "Error al bloquear:", "No se pudo bloquear. Inténtalo de nuevo.");
  }
}

// Desbloquear (la amistad no se restablece)
export async function unblockUser(meId: string, username: string): Promise<Result> {
  try {
    await connectDB();
    const target = await findUserByUsername(username);
    if (!target) return unknownUser();
    await Block.deleteOne({ blocker: meId, blocked: target._id });
    return { ok: true };
  } catch (err) {
    return failed(err, "Error al desbloquear:", "No se pudo desbloquear. Inténtalo de nuevo.");
  }
}
