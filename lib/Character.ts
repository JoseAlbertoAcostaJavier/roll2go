import mongoose, { Schema } from "mongoose";

const CharacterSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    }, // el jugador
    name: { type: String, required: true, trim: true, maxlength: 80 },
    systemId: { type: String, required: true }, // id de lib/systems.ts
    books: { type: [String], default: [] }, // libros de reglas que usa (ids de `Book`)

    // Campaña a la que pertenece (vacío = personaje independiente, todavía sin campaña)
    campaign: { type: Schema.Types.ObjectId, ref: "Campaign", index: true },
    // "internal": creado desde la campaña. "external": creado fuera y añadido después
    origin: { type: String, enum: ["internal", "external"] },

    imageId: { type: Schema.Types.ObjectId, ref: "CampaignImage" },
    backstory: { type: String, default: "", maxlength: 100000 }, // BBCode
    // La hoja del personaje: cada sistema tiene campos distintos, así que es flexible
    sheet: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false },
);
CharacterSchema.index({ campaign: 1, createdAt: 1 });

export const Character =
  mongoose.models.Character || mongoose.model("Character", CharacterSchema);
