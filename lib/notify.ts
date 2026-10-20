import { after } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Notification } from "@/lib/Notification";
import { User } from "@/lib/User";
import { Campaign } from "@/lib/Campaign";
import {
  describeNotification,
  emailPrefFor,
  type NotificationType,
} from "@/lib/notificationText";
import { sendNotificationEmail } from "@/lib/notifyMail";

// Valores por defecto para cuentas que todavía no han tocado sus preferencias
const DEFAULT_EMAIL_PREFS = { campaigns: true, messages: false, social: true };

type Input = {
  user: string;
  type: NotificationType;
  actor?: string;
  campaign?: string;
  text?: string;
};

export async function countUnread(userId: string) {
  await connectDB();
  return Notification.countDocuments({ user: userId, read: false });
}

export async function notify(input: Input) {
  await connectDB();

  // Mensajes seguidos de la misma persona: una sola notificación con contador (y un solo correo)
  if (input.type === "message" && input.actor) {
    const existing = await Notification.findOne({
      user: input.user,
      type: "message",
      actor: input.actor,
      read: false,
    }).select("_id");
    if (existing) {
      await Notification.updateOne(
        { _id: existing._id },
        { $inc: { count: 1 }, $set: { createdAt: new Date() } },
      );
      return;
    }
  }

  await Notification.create({
    user: input.user,
    type: input.type,
    actor: input.actor,
    campaign: input.campaign,
    text: input.text,
  });

  // Correo, si el tipo lo admite y el usuario lo ha activado
  const pref = emailPrefFor(input.type);
  if (!pref) return;
  const recipient = await User.findById(input.user)
    .select("email emailPrefs")
    .lean();
  if (!recipient) return;
  if (!(recipient.emailPrefs?.[pref] ?? DEFAULT_EMAIL_PREFS[pref])) return;

  const [actor, campaign] = await Promise.all([
    input.actor
      ? User.findById(input.actor).select("username displayName").lean()
      : null,
    input.campaign
      ? Campaign.findById(input.campaign).select("name").lean()
      : null,
  ]);
  const { text, href } = describeNotification(
    { type: input.type, text: input.text },
    actor
      ? {
          username: actor.username,
          displayName: actor.displayName || actor.username,
        }
      : null,
    campaign ? { id: String(campaign._id), name: campaign.name } : null,
  );
  // El correo se envía DESPUÉS de responder, para no retrasar la acción del usuario
  after(async () => {
    try {
      await sendNotificationEmail(recipient.email, text, href);
    } catch (err) {
      console.error("No se pudo enviar el correo de notificación:", err);
    }
  });
}
