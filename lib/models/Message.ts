import mongoose, { Schema } from "mongoose";

const MessageSchema = new Schema(
  {
    from: { type: Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: Schema.Types.ObjectId, ref: "User", required: true },
    pair: { type: String, required: true }, // ids de los dos ordenados y unidos (ver pairKey)
    text: { type: String, required: true, maxlength: 2000 },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
MessageSchema.index({ pair: 1, createdAt: -1 });
MessageSchema.index({ from: 1, createdAt: -1 });
MessageSchema.index({ to: 1, readAt: 1 });

export const Message =
  mongoose.models.Message || mongoose.model("Message", MessageSchema);
