import mongoose, { Schema } from "mongoose";

const BookSchema = new Schema(
  {
    // null = libro oficial de Roll2Go (SRD). Solo se crea por script/admin.
    owner: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    // Sigla de la fuente ("XPHB"). Única entre los oficiales; vacía en los de usuario.
    key: { type: String, default: "" },
    systemId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 20000 }, // BBCode
    language: { type: String, default: "es", maxlength: 8 },
    // private: solo el autor. public: lo ve cualquiera (la Librería llegará más adelante).
    visibility: { type: String, enum: ["private", "public"], default: "private", index: true },
    license: {
      // "own" = creación del usuario; "srd" = SRD con CC BY 4.0; "official" = contenido protegido
      type: { type: String, enum: ["own", "srd", "official"], default: "own" },
      attribution: { type: String, default: "", maxlength: 1000 },
      sourceUrl: { type: String, default: "", maxlength: 500 },
    },
  },
  { timestamps: true },
);

BookSchema.index({ owner: 1, systemId: 1, name: 1 });
// La clave solo es única entre los libros oficiales con clave
BookSchema.index(
  { key: 1 },
  { unique: true, partialFilterExpression: { owner: null, key: { $gt: "" } } },
);

export const Book = mongoose.models.Book || mongoose.model("Book", BookSchema);