import mongoose, { Schema } from "mongoose";

const CampaignSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    systemId: { type: String, required: true }, // id de lib/systems.ts
    // Activa: sale en el listado principal. Inactiva: solo con el filtro "Inactivas" o "Todas"
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true }, // el DM
    members: [{ type: Schema.Types.ObjectId, ref: "User" }], // jugadores (el DM también está aquí)
    // Lista de bloqueados de la campaña: no pueden volver a unirse (ni por enlace ni por invitación)
    banned: [{ type: Schema.Types.ObjectId, ref: "User" }],
    imageId: { type: Schema.Types.ObjectId, ref: "CampaignImage" },
    logoId: { type: Schema.Types.ObjectId, ref: "CampaignImage" },

    shortDescription: { type: String, default: "", maxlength: 300 },
    description: { type: String, default: "", maxlength: 100000 }, // BBCode
    // Solo la ve el DM: select false -> no se devuelve salvo que se pida con .select("+privateNotes")
    privateNotes: {
      type: String,
      default: "",
      maxlength: 20000,
      select: false,
    },

    // Si restrictBooks es true, los personajes solo pueden usar los libros de allowedBooks
    restrictBooks: { type: Boolean, default: false },
    allowedBooks: { type: [String], default: [] },

    characters: {
      allowed: { type: Boolean, default: true },
      internal: { type: Boolean, default: true }, // creados desde la propia campaña (con los libros permitidos)
      external: { type: Boolean, default: true }, // creados fuera y añadidos después (pueden usar otros libros)
    },

    // Enlace de invitación. Cuando no hay enlace, los campos NO existen (se borran con $unset, nunca a null,
    // porque un índice único "sparse" sí indexa los null).
    inviteCode: { type: String, select: false, unique: true, sparse: true },
    inviteExpires: { type: Date, select: false },
  },
  { timestamps: true },
);
CampaignSchema.index({ members: 1, status: 1, updatedAt: -1 });

export const Campaign =
  mongoose.models.Campaign || mongoose.model("Campaign", CampaignSchema);
