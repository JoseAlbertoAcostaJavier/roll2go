import mongoose, { Schema } from "mongoose";

// Tipos que existirán. En la fase 1 solo se valida que el tipo sea uno de estos.
export const ENTRY_KINDS = [
  "spell",
  "item",
  "feat",
  "background",
  "species",
  "class",
  "subclass",
  "feature",
  "rule",
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

const BookEntrySchema = new Schema(
  {
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    kind: { type: String, enum: ENTRY_KINDS, required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameLower: { type: String, required: true },
    description: { type: String, default: "", maxlength: 50000 }, // BBCode
    // Campos propios de cada tipo. En la fase 2 se validan según `kind`.
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

BookEntrySchema.index({ book: 1, kind: 1, nameLower: 1 });

export const BookEntry =
  mongoose.models.BookEntry || mongoose.model("BookEntry", BookEntrySchema);