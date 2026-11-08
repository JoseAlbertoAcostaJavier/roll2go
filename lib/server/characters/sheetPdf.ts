import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFCheckBox, PDFDocument, PDFTextField, StandardFonts } from "pdf-lib";
import type { PdfValues } from "@/lib/rules/dnd2024/sheet/pdfValues";

const TEMPLATE = path.join(process.cwd(), "public/assets/sheets/dnd-2024/DnD_2024_Character-Sheet.pdf");

// La fuente estándar del PDF solo admite WinAnsi: lo demás se sustituye para que no falle la escritura
const REPLACEMENTS: Record<string, string> = { "→": "->", "←": "<-", "≥": ">=", "≤": "<=", "−": "-", "‑": "-" };
export const pdfSafe = (value: string) => value
  .replace(/[→←≥≤−‑]/g, (c) => REPLACEMENTS[c])
  .replace(/[^\t\r\n\x20-\x7E -ÿ–—‘’“”•…€]/g, "");

let template: Promise<Buffer> | null = null;
const templateBytes = () => {
  template ??= readFile(TEMPLATE).catch((e) => {
    template = null;
    throw e;
  });
  return template;
};

/** Nombres de los campos de la plantilla. */
export async function pdfFieldNames(): Promise<Set<string>> {
  const doc = await PDFDocument.load(await templateBytes());
  return new Set(doc.getForm().getFields().map((f) => f.getName()));
}

/** Rellena la plantilla y devuelve un PDF que sigue siendo editable: conserva sus campos con los datos escritos. */
export async function fillSheetPdf(values: PdfValues): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await templateBytes());
  const form = doc.getForm();
  const fields = new Map(form.getFields().map((f) => [f.getName(), f]));

  for (const [name, raw] of Object.entries(values.text)) {
    const field = fields.get(name);
    if (!(field instanceof PDFTextField)) continue;
    const value = pdfSafe(raw);
    const max = field.getMaxLength();
    field.setText(max ? value.slice(0, max) : value);
  }
  for (const [name, size] of Object.entries(values.sizes)) {
    const field = fields.get(name);
    if (field instanceof PDFTextField) field.setFontSize(size);
  }
  for (const name of values.checked) {
    const field = fields.get(name);
    if (field instanceof PDFCheckBox) field.check();
  }

  form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));
  return doc.save();
}
