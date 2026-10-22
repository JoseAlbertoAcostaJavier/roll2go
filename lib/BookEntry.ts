import mongoose, { Schema } from "mongoose";
import type { EntryKind } from "@/lib/rules/types";

// Tipos de entrada del catálogo (deben coincidir con EntryKind de lib/rules/types.ts)
export const ENTRY_KINDS: readonly EntryKind[] = [
  "species",
  "lineage",
  "class",
  "subclass",
  "classFeature",
  "subclassFeature",
  "background",
  "feat",
  "spell",
  "item",
  "language",
  "skill",
];
export type { EntryKind };

const BookEntrySchema = new Schema(
  {
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    kind: { type: String, enum: ENTRY_KINDS, required: true },
    // Clave estable en minúsculas, estilo 5etools ("elf|xphb"). Única por libro.
    key: { type: String, required: true, maxlength: 200 },
    // Identificador corto estilo Foundry ("elf")
    identifier: { type: String, default: "", maxlength: 120 },
    // Entrada de la que depende (legado -> especie, subclase -> clase, rasgo -> clase/subclase)
    parent: {
      type: new Schema(
        {
          book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
          key: { type: String, required: true },
        },
        { _id: false },
      ),
      default: undefined,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameEs: { type: String, default: "", trim: true, maxlength: 120 },
    // normalizeName(nameEs || name): minúsculas y sin tildes, para buscar
    nameLower: { type: String, required: true },
    description: { type: String, default: "", maxlength: 50000 }, // BBCode
    descriptionEs: { type: String, default: "", maxlength: 50000 },
    srd52: { type: Boolean, default: false },
    // Campos normalizados según `kind` (ver lib/rules/schemas.ts)
    data: { type: Schema.Types.Mixed, default: {} },
    // Activities y efectos de Foundry tal cual; solo para exportar
    foundry: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

BookEntrySchema.index({ book: 1, key: 1 }, { unique: true });
BookEntrySchema.index({ book: 1, kind: 1, nameLower: 1 });
BookEntrySchema.index({ kind: 1, "parent.key": 1 });

export const BookEntry =
  mongoose.models.BookEntry || mongoose.model("BookEntry", BookEntrySchema);
