import mongoose, { Schema } from "mongoose";

const HomebrewSchema = new Schema(
  {
    campaign: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: [
        "race",
        "class",
        "subclass",
        "spell",
        "item",
        "feat",
        "rule",
        "lore",
      ],
      required: true,
    },
    name: { type: String, required: true, maxlength: 80 },
    content: { type: String, required: true, maxlength: 3000 },
    // "players": lo ven todos los miembros. "dm": solo el director de juego (secretos, spoilers...)
    visibility: { type: String, enum: ["players", "dm"], default: "players" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const HomebrewEntry =
  mongoose.models.HomebrewEntry ||
  mongoose.model("HomebrewEntry", HomebrewSchema);
