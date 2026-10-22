import mongoose, { Schema } from "mongoose";
import { NOTIFICATION_TYPES } from "@/lib/notificationText";

const NotificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true }, // quien la recibe
  type: { type: String, enum: [...NOTIFICATION_TYPES], required: true },
  actor: { type: Schema.Types.ObjectId, ref: "User" }, // quien la provoca
  campaign: { type: Schema.Types.ObjectId, ref: "Campaign" },
  post: { type: Schema.Types.ObjectId }, // mensaje del foro al que se refiere (para enlazar directo al hilo)
  text: { type: String, maxlength: 500 }, // solo en avisos de Roll2Go
  count: { type: Number, default: 1 }, // mensajes seguidos agrupados en una sola notificación
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });
// Se borran solas a los 90 días
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

export const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);
