import "server-only";
// Alta de un personaje y «Rehacer creación» de uno de nivel 1. Los dos validan la hoja con validateSheet, con los
// libros que puede usar el personaje.
import { connectDB } from "@/lib/models/mongodb";
import { Campaign } from "@/lib/models/Campaign";
import { CampaignImage } from "@/lib/models/CampaignImage";
import { Character } from "@/lib/models/Character";
import { notify } from "@/lib/server/notifications/notify";
import { MAX_IMAGE, readImage, storeImage } from "@/lib/server/campaigns/campaignInput";
import { OUTDATED_SHEET_ERROR, loadCharacterFor } from "@/lib/server/characters/characterAccess";
import { NotFoundError, listEntries, resolveRef, usableBooks } from "@/lib/server/catalog/catalog";
import { languagePool } from "@/lib/rules/dnd2024/creation/languages";
import { isValidId, newId } from "@/lib/server/ids";
import { fail, invalid, type Result } from "@/lib/server/result";
import { cleanText } from "@/lib/utils/utils";
import { system as rpgSystems } from "@/lib/utils/systems";
import { validateSheet } from "@/lib/rules/dnd2024/creation/validateSheet";
import { ALIGNMENTS } from "@/lib/rules/dnd2024/sheet/alignments";
import { parsePronouns } from "@/lib/rules/dnd2024/creation/names";
import { creationUpdate } from "@/lib/rules/dnd2024/creation/recreate";
import { LEVEL_CHANGED } from "@/lib/rules/dnd2024/levels/levelOps";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";

const STATUSES = ["active", "retired", "dead", "npc"] as const;
const MAX_NAME = 80;
const MAX_BACKSTORY = 100000;
const MAX_BOOKS = 50;

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const campaignNotFound = () => fail(404, "Campaña no encontrada.");

// Valida la hoja del formulario (`sheet`, JSON) con los libros dados; añade a `errors` los suyos y el alineamiento
async function checkSheet(
  form: FormData,
  userId: string,
  books: string[],
  errors: Record<string, string>,
  extra: { keptRolls?: Dnd2024SheetV2["rolls"] } = {},
) {
  let rawSheet: unknown = null;
  try {
    rawSheet = JSON.parse(text(form.get("sheet")) || "null");
  } catch {
    // JSON mal formado: validateSheet lo rechaza como hoja no válida
  }
  const result = await validateSheet(rawSheet, {
    userId,
    books,
    resolve: (ref) => resolveRef(ref, books),
    makeId: newId,
    languagePool: async () => languagePool(await listEntries({ books, kind: "language" })),
    // Legados de la especie en su mismo libro (como los muestra el asistente)
    hasLineages: async (species) =>
      (await listEntries({ books, kind: "lineage", parent: species.key })).some((l) => l.ref.book === species.book),
    ...extra,
  });
  if (!result.ok) Object.assign(errors, result.errors);
  else if (result.sheet.alignment && !ALIGNMENTS.some((a) => a.id === result.sheet.alignment))
    errors.alignment = "Alineamiento no válido.";
  return result;
}

// Nombre y pronombres del formulario, con sus errores
function checkNameAndPronouns(form: FormData, errors: Record<string, string>) {
  const name = cleanText(text(form.get("name"))).trim();
  if (!name) errors.name = "Escribe un nombre.";
  else if (name.length > MAX_NAME) errors.name = `Máximo ${MAX_NAME} caracteres.`;
  const pronouns = parsePronouns(text(form.get("pronouns")));
  return { name, pronouns };
}

/* Crea un personaje con el formulario del creador: `sheet` (JSON), `system`, `name`, `pronouns` («he,they»), `status`,
   `campaign`, `books`, `backstory`, `portrait` e `image`. Devuelve su id, o los errores por campo. */
export async function createCharacter(userId: string, form: FormData): Promise<Result<{ id: string }>> {
  const systemId = text(form.get("system"));
  if (!rpgSystems.some((s) => s.id === systemId && s.creator))
    return fail(400, "Sistema de juego no disponible.");

  const errors: Record<string, string> = {};
  const { name, pronouns } = checkNameAndPronouns(form, errors);
  const status = text(form.get("status")) as (typeof STATUSES)[number];
  if (!STATUSES.includes(status)) errors.status = "Estado no válido.";
  const backstory = cleanText(text(form.get("backstory")));
  if (backstory.length > MAX_BACKSTORY) errors.backstory = "La historia es demasiado larga.";
  if (!pronouns) errors.pronouns = "Pronombres no válidos.";

  // Campaña: hay que ser miembro (si no, 404) y que admita personajes internos del mismo sistema
  await connectDB();
  const campaignId = text(form.get("campaign"));
  let campaign: { _id: unknown; owner: unknown; restrictBooks?: boolean } | null = null;
  if (campaignId) {
    if (!isValidId(campaignId)) return campaignNotFound();
    const doc = await Campaign.findOne({ _id: campaignId, members: userId })
      .select("owner systemId restrictBooks characters")
      .lean();
    if (!doc) return campaignNotFound();
    if (doc.systemId !== systemId) errors.campaign = "La campaña es de otro sistema de juego.";
    else if (!(doc.characters?.allowed === true && doc.characters?.internal === true))
      errors.campaign = "Esta campaña no admite personajes creados desde Roll2Go.";
    campaign = doc;
  }

  // Libros: el servidor recalcula los permitidos; lo que no se pueda usar se ignora
  const chosen = text(form.get("books")).split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_BOOKS);
  let books: string[];
  try {
    books = await usableBooks({ userId, systemId, campaignId: campaignId || undefined, chosenBooks: chosen });
  } catch (e) {
    if (e instanceof NotFoundError) return campaignNotFound();
    throw e;
  }

  // La hoja se guarda en v2; el equipo inicial se carga con los mismos libros para volcarlo al inventario
  const result = await checkSheet(form, userId, books, errors);

  const portrait = await readImage(form.get("portrait"), MAX_IMAGE);
  const image = await readImage(form.get("image"), MAX_IMAGE);
  if (portrait.error) errors.portrait = portrait.error;
  if (image.error) errors.image = image.error;

  if (Object.keys(errors).length > 0 || !result.ok) return invalid(errors);

  // Todo es válido: se guardan las imágenes y el personaje. Si algo falla, se borran las imágenes huérfanas.
  const created: unknown[] = [];
  let id: string;
  try {
    let portraitId, imageId;
    if (portrait.image) {
      portraitId = await storeImage(portrait.image, userId);
      created.push(portraitId);
    }
    if (image.image) {
      imageId = await storeImage(image.image, userId);
      created.push(imageId);
    }
    const character = await Character.create({
      owner: userId,
      name,
      pronouns: pronouns ?? [],
      systemId,
      // Solo se guarda el filtro propio del personaje; si manda el de la campaña o se ignoró por no tener
      // ningún libro visible, no hace falta
      books: !campaign?.restrictBooks && books.some((id) => chosen.includes(id)) ? books : [],
      ...(campaign ? { campaign: campaign._id, origin: "internal", campaignStatus: "approved" } : {}),
      status,
      portraitId,
      imageId,
      backstory,
      sheet: result.sheet,
    });
    id = String(character._id);
  } catch (err) {
    if (created.length) await CampaignImage.deleteMany({ _id: { $in: created } });
    console.error("Error al crear el personaje:", err);
    return fail(500, "No se pudo crear el personaje. Inténtalo de nuevo.");
  }

  // Aviso al DM (si no es quien lo crea). Un fallo aquí no deshace la creación.
  if (campaign && String(campaign.owner) !== userId) {
    try {
      await notify({
        user: String(campaign.owner),
        type: "character_created",
        actor: userId,
        campaign: String(campaign._id),
      });
    } catch (err) {
      console.error("No se pudo avisar al DM del nuevo personaje:", err);
    }
  }

  return { ok: true, id };
}

/* Rehace la creación de un personaje de nivel 1 (solo el dueño) con `sheet`, `name` y `pronouns`. Mismas
   validaciones que el alta; sustituye los datos de creación y el nivel 1 y vuelve a volcar el equipo inicial al
   inventario. 409 si el personaje cambió de nivel entretanto. */
export async function recreateCharacter(userId: string, id: string, form: FormData): Promise<Result> {
  const found = await loadCharacterFor(userId, id, "write");
  if (!found) return fail(404, "Personaje no encontrado.");
  if (found.outdated) return fail(409, OUTDATED_SHEET_ERROR);
  if (found.sheet.levels.length !== 1) return fail(400, "Solo se puede rehacer a nivel 1.");

  const errors: Record<string, string> = {};
  const { name, pronouns } = checkNameAndPronouns(form, errors);
  if (!pronouns) errors.pronouns = "Pronombres no válidos.";

  // Los libros del personaje, como en el resto de su ficha. Las tiradas de la creación anterior siguen valiendo
  // aunque su token haya caducado.
  const result = await checkSheet(form, userId, found.books, errors, { keptRolls: found.sheet.rolls });
  if (Object.keys(errors).length > 0 || !result.ok) return invalid(errors);

  // Solo si sigue siendo v2 y de nivel 1 (si alguien subió de nivel entretanto, no se pisa)
  const res = await Character.updateOne(
    { _id: id, "sheet.version": 2, "sheet.levels": { $size: 1 } },
    { $set: { name, pronouns: pronouns ?? [], ...creationUpdate(result.sheet) } },
  );
  if (res.matchedCount === 0) return fail(409, LEVEL_CHANGED);
  return { ok: true };
}
