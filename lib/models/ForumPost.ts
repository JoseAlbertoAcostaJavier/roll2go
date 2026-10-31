import mongoose, { Schema } from "mongoose";

const ForumPostSchema = new Schema(
  {
    campaign: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // null = mensaje principal. Si es una respuesta, id del mensaje principal (el hilo).
    parent: { type: Schema.Types.ObjectId, ref: "ForumPost", default: null },
    // A qué respuesta concreta contesta (opcional, solo en respuestas)
    replyTo: { type: Schema.Types.ObjectId, ref: "ForumPost" },
    title: { type: String, trim: true, maxlength: 120, default: "" }, // solo en mensajes principales
    content: { type: String, required: true, maxlength: 10000 }, // BBCode
    pinned: { type: Boolean, default: false }, // solo en mensajes principales
    lastActivityAt: { type: Date, default: Date.now }, // solo en mensajes principales: se actualiza con cada respuesta
    editedAt: { type: Date },
  },
  { timestamps: true },
);
// Listado de hilos de una campaña: fijados primero y después por última actividad
ForumPostSchema.index({ campaign: 1, parent: 1, pinned: -1, lastActivityAt: -1 });
// Respuestas de un hilo, en orden
ForumPostSchema.index({ parent: 1, createdAt: 1 });
ForumPostSchema.index({ author: 1 });

export const ForumPost = mongoose.models.ForumPost || mongoose.model("ForumPost", ForumPostSchema);