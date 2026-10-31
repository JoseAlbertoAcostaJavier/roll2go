import mongoose, { Schema } from "mongoose";

const CampaignInviteSchema = new Schema({
  campaign: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true }, // la persona invitada
  invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, // el DM
  createdAt: { type: Date, default: Date.now },
});
CampaignInviteSchema.index({ campaign: 1, user: 1 }, { unique: true });
CampaignInviteSchema.index({ user: 1 });
// Las invitaciones sin responder caducan a los 30 días
CampaignInviteSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

export const CampaignInvite =
  mongoose.models.CampaignInvite ||
  mongoose.model("CampaignInvite", CampaignInviteSchema);
