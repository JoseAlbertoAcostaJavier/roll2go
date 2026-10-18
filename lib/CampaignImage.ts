import mongoose, { Schema } from "mongoose";

const CampaignImageSchema = new Schema(
  {
    data: { type: Buffer, required: true },
    contentType: {
      type: String,
      enum: ["image/png", "image/jpeg", "image/webp"],
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

export const CampaignImage =
  mongoose.models.CampaignImage ||
  mongoose.model("CampaignImage", CampaignImageSchema);
