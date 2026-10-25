import mongoose, { Schema } from "mongoose";

const ForumReactionSchema = new Schema(
  {
    campaign: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    post: { type: Schema.Types.ObjectId, ref: "ForumPost", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true, maxlength: 16 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
ForumReactionSchema.index({ post: 1, user: 1, emoji: 1 }, { unique: true });
ForumReactionSchema.index({ campaign: 1 });
ForumReactionSchema.index({ user: 1 });

export const ForumReaction = mongoose.models.ForumReaction || mongoose.model("ForumReaction", ForumReactionSchema);