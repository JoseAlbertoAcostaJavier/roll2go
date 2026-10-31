import mongoose, { Schema } from "mongoose";

const BlockSchema = new Schema(
  {
    blocker: { type: Schema.Types.ObjectId, ref: "User", required: true }, // quien bloquea
    blocked: { type: Schema.Types.ObjectId, ref: "User", required: true }, // el bloqueado
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
BlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
BlockSchema.index({ blocked: 1 });

export const Block =
  mongoose.models.Block || mongoose.model("Block", BlockSchema);
