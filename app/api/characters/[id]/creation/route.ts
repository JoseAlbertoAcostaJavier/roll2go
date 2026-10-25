import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { cleanText } from "@/lib/utils/utils";
import { Character } from "@/lib/models/Character";
import { OUTDATED_SHEET_ERROR, loadCharacterFor } from "@/lib/server/characters/characterAccess";
import { listEntries, resolveRef } from "@/lib/server/catalog/catalog";
import { ALIGNMENTS } from "@/lib/rules/dnd2024/sheet/alignments";
import { parsePronouns } from "@/lib/rules/dnd2024/creation/names";
import { creationUpdate } from "@/lib/rules/dnd2024/creation/recreate";
import { validateSheet } from "@/lib/rules/dnd2024/creation/validateSheet";

type Ctx = { params: Promise<{ id: string }> };

const MAX_NAME = 80;
const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

// Rehace la creación de un personaje de nivel 1: multipart/form-data con `sheet` (JSON, como en el alta), `name` y
// `pronouns`. Solo el dueño. Mismas validaciones que el alta; sustituye los datos de creación y el nivel 1 y vuelve a
// volcar el equipo inicial al inventario. Responde 200 { id }, 400 { errors } o { error }, y 409 si el personaje cambió
// de nivel entretanto.
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("character_level", session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const found = await loadCharacterFor(session.id, id, "write");
  if (!found) return NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });
  if (found.outdated) return NextResponse.json({ error: OUTDATED_SHEET_ERROR }, { status: 409 });
  if (found.sheet.levels.length !== 1)
    return NextResponse.json({ error: "Solo se puede rehacer a nivel 1." }, { status: 400 });

  const errors: Record<string, string> = {};
  const name = cleanText(text(form.get("name"))).trim();
  if (!name) errors.name = "Escribe un nombre.";
  else if (name.length > MAX_NAME) errors.name = `Máximo ${MAX_NAME} caracteres.`;
  const pronouns = parsePronouns(text(form.get("pronouns")));
  if (!pronouns) errors.pronouns = "Pronombres no válidos.";

  let rawSheet: unknown = null;
  try {
    rawSheet = JSON.parse(text(form.get("sheet")) || "null");
  } catch {
    // JSON mal formado: validateSheet lo rechaza como hoja no válida
  }
  // Los libros del personaje, como en el resto de su ficha
  const { books } = found;
  const result = await validateSheet(rawSheet, {
    userId: session.id,
    books,
    resolve: (ref) => resolveRef(ref, books),
    makeId: () => new mongoose.Types.ObjectId().toHexString(),
    hasLineages: async (species) =>
      (await listEntries({ books, kind: "lineage", parent: species.key })).some((l) => l.ref.book === species.book),
    // Las tiradas de la creación anterior siguen valiendo aunque su token haya caducado
    keptRolls: found.sheet.rolls,
  });
  if (!result.ok) Object.assign(errors, result.errors);
  else if (result.sheet.alignment && !ALIGNMENTS.some((a) => a.id === result.sheet.alignment))
    errors.alignment = "Alineamiento no válido.";
  if (Object.keys(errors).length > 0 || !result.ok) return NextResponse.json({ errors }, { status: 400 });

  // Solo si sigue siendo v2 y de nivel 1 (si alguien subió de nivel entretanto, no se pisa)
  const res = await Character.updateOne(
    { _id: id, "sheet.version": 2, "sheet.levels": { $size: 1 } },
    { $set: { name, pronouns: pronouns ?? [], ...creationUpdate(result.sheet) } },
  );
  if (res.matchedCount === 0)
    return NextResponse.json({ error: "El personaje ha cambiado de nivel; recarga la página." }, { status: 409 });

  return NextResponse.json({ id });
}
