import mongoose, { Schema } from "mongoose";

const FriendshipSchema = new Schema(
  {
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted"], default: "pending" },
    // Ids de los dos usuarios, ordenados y unidos: impide duplicados en cualquier dirección
    pair: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);
FriendshipSchema.index({ requester: 1, status: 1 });
FriendshipSchema.index({ recipient: 1, status: 1 });

export const pairKey = (a: string, b: string) => [a, b].sort().join(":");
export const Friendship =
  mongoose.models.Friendship || mongoose.model("Friendship", FriendshipSchema);
