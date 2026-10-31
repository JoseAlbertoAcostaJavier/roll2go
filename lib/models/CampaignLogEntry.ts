import mongoose, { Schema } from "mongoose";

const CampaignLogEntrySchema = new Schema(
  {
    campaign: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, maxlength: 50000 }, // BBCode
    // "public": la ven todos los participantes. "private": solo su autor y el DM
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "private",
    },
  },
  { timestamps: true },
);
// Listado de una campaña, de la más nueva a la más antigua
CampaignLogEntrySchema.index({ campaign: 1, createdAt: -1 });

export const CampaignLogEntry =
  mongoose.models.CampaignLogEntry ||
  mongoose.model("CampaignLogEntry", CampaignLogEntrySchema);
