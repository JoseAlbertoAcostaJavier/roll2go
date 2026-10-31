import "server-only";
// Acciones de la moderación: advertir, banear y quitar el baneo a un usuario, y el aviso a todos. Quien las pide ya es
// administrador (requireAdminApi, que ya ha conectado con la base de datos) y el motivo o el texto ya vienen validados.
import { BannedEmail } from "@/lib/models/BannedEmail";
import { Notification } from "@/lib/models/Notification";
import { User } from "@/lib/models/User";
import { forgetBan } from "@/lib/server/auth/ban";
import { isValidId } from "@/lib/server/ids";
import { notify } from "@/lib/server/notifications/notify";
import { fail, type Result } from "@/lib/server/result";

const notFound = () => fail(404, "Usuario no encontrado.");

// Se guarda en su historial y se le avisa con una notificación
export async function warnUser(adminId: string, userId: string, reason: string): Promise<Result> {
  if (!isValidId(userId)) return notFound();
  if (userId === adminId) return fail(400, "No puedes advertirte a ti mismo.");

  try {
    const res = await User.updateOne(
      { _id: userId },
      { $push: { warnings: { reason, by: adminId, createdAt: new Date() } } },
    );
    if (res.matchedCount === 0) return notFound();

    await notify({
      user: userId,
      type: "system",
      text: `Has recibido una advertencia de la moderación de Roll2Go. Motivo: ${reason}`,
    });
    return { ok: true };
  } catch (err) {
    console.error("Error al advertir al usuario:", err);
    return fail(500, "No se pudo guardar la advertencia. Inténtalo de nuevo.");
  }
}

// Baneo para siempre: cierra sus sesiones, le impide entrar y reserva su correo para que no se registre otra vez
export async function banUser(adminId: string, userId: string, reason: string): Promise<Result> {
  if (!isValidId(userId)) return notFound();
  if (userId === adminId) return fail(400, "No puedes banearte a ti mismo.");

  try {
    const target = await User.findById(userId).select("email role bannedAt").lean();
    if (!target) return notFound();
    if (target.role === "admin") return fail(403, "No puedes banear a otro administrador.");
    if (target.bannedAt) return fail(409, "Este usuario ya está baneado.");

    // Las condiciones se repiten en la consulta por si el rol cambió entre medias
    const res = await User.updateOne(
      { _id: userId, role: { $ne: "admin" }, bannedAt: null },
      { $set: { bannedAt: new Date(), banReason: reason, bannedBy: adminId } },
    );
    if (res.modifiedCount === 0) return fail(409, "No se pudo banear a este usuario.");

    await BannedEmail.updateOne({ email: target.email }, { $set: { user: target._id } }, { upsert: true });
    forgetBan(userId);
    return { ok: true };
  } catch (err) {
    console.error("Error al banear al usuario:", err);
    return fail(500, "No se pudo banear al usuario. Inténtalo de nuevo.");
  }
}

// Quitar el baneo: vuelve a poder iniciar sesión y su correo queda libre
export async function unbanUser(userId: string): Promise<Result> {
  if (!isValidId(userId)) return notFound();

  try {
    const target = await User.findById(userId).select("email bannedAt").lean();
    if (!target) return notFound();
    if (!target.bannedAt) return fail(409, "Este usuario no está baneado.");

    await User.updateOne({ _id: userId }, { $set: { bannedAt: null, banReason: "" }, $unset: { bannedBy: 1 } });
    await BannedEmail.deleteMany({ $or: [{ user: target._id }, { email: target.email }] });
    forgetBan(userId);
    await notify({
      user: userId,
      type: "system",
      text: "La moderación de Roll2Go ha levantado la suspensión de tu cuenta.",
    });
    return { ok: true };
  } catch (err) {
    console.error("Error al quitar el baneo:", err);
    return fail(500, "No se pudo quitar el baneo. Inténtalo de nuevo.");
  }
}

// Aviso a todos: una notificación por usuario verificado, en lotes de 500. Devuelve cuántas se han enviado.
export async function sendAnnouncement(text: string): Promise<Result<{ sent: number }>> {
  try {
    const now = new Date();
    let batch: object[] = [];
    let sent = 0;
    for await (const u of User.find({ verified: true }).select("_id").lean().cursor()) {
      batch.push({ user: u._id, type: "system", text, createdAt: now });
      if (batch.length >= 500) {
        await Notification.insertMany(batch, { ordered: false });
        sent += batch.length;
        batch = [];
      }
    }
    if (batch.length) {
      await Notification.insertMany(batch, { ordered: false });
      sent += batch.length;
    }
    return { ok: true, sent };
  } catch (err) {
    console.error("Error al enviar el aviso masivo:", err);
    return fail(500, "No se pudo enviar el aviso. Inténtalo de nuevo.");
  }
}
