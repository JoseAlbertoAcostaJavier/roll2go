import "server-only";
// Editar los datos de un personaje y borrarlo. Solo el dueño (loadCharacterFor en modo "write").
import { Character } from "@/lib/models/Character";
import { Notification } from "@/lib/models/Notification";
import { CampaignImage } from "@/lib/models/CampaignImage";
import { OUTDATED_SHEET_ERROR, loadCharacterFor } from "@/lib/server/characters/characterAccess";
import { MAX_IMAGE, readImage, storeImage } from "@/lib/server/campaigns/campaignInput";
import { fail, invalid, type Result } from "@/lib/server/result";
import { cleanText } from "@/lib/utils/utils";
import { ALIGNMENTS } from "@/lib/rules/dnd2024/sheet/alignments";
import { parsePronouns } from "@/lib/rules/dnd2024/creation/names";
import { MAX_XP } from "@/lib/rules/dnd2024/creation/validateSheet";
import { SHEET_TEXT_LIMITS } from "@/lib/rules/dnd2024/sheet/textFields";

const STATUSES = ["active", "retired", "dead", "npc"] as const;
const MAX_NAME = 80;
const MAX_BACKSTORY = 100000;

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const notFound = () => fail(404, "Personaje no encontrado.");

/* Cambia lo que llega en el formulario: `name`, `pronouns`, `status`, `alignment`, `age`, `appearance`, `languages`,
   `backstory`, `notes`, los campos de trasfondo y notas (`SHEET_TEXT_LIMITS`), `xp`, `portrait`, `image`, y las marcas `removePortrait` / `removeImage`. Mismos límites que
   el alta. */
export async function updateCharacter(userId: string, id: string, form: FormData): Promise<Result> {
  const found = await loadCharacterFor(userId, id, "write");
  if (!found) return notFound();
  const { character } = found;

  const errors: Record<string, string> = {};
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  const sheetSet: Record<string, unknown> = {};

  if (form.has("name")) {
    const name = cleanText(text(form.get("name"))).trim();
    if (!name) errors.name = "Escribe un nombre.";
    else if (name.length > MAX_NAME) errors.name = `Máximo ${MAX_NAME} caracteres.`;
    else set.name = name;
  }
  if (form.has("status")) {
    const status = text(form.get("status")) as (typeof STATUSES)[number];
    if (!STATUSES.includes(status)) errors.status = "Estado no válido.";
    else set.status = status;
  }
  if (form.has("pronouns")) {
    const pronouns = parsePronouns(text(form.get("pronouns")));
    if (!pronouns) errors.pronouns = "Pronombres no válidos.";
    else set.pronouns = pronouns;
  }
  if (form.has("backstory")) {
    const backstory = cleanText(text(form.get("backstory")));
    if (backstory.length > MAX_BACKSTORY) errors.backstory = "La historia es demasiado larga.";
    else set.backstory = backstory;
  }
  for (const [field, max] of Object.entries(SHEET_TEXT_LIMITS)) {
    if (!form.has(field)) continue;
    const raw = form.get(field);
    if (typeof raw !== "string") errors[field] = "Texto no válido.";
    else if (raw.length > max) errors[field] = `Máximo ${max} caracteres.`;
    else if (field === "alignment" && raw && !ALIGNMENTS.some((a) => a.id === raw)) errors.alignment = "Alineamiento no válido.";
    else sheetSet[field] = cleanText(raw).trim();
  }
  if (form.has("xp")) {
    const raw = text(form.get("xp")).trim();
    const xp = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(xp) || xp > MAX_XP) errors.xp = `Los puntos de experiencia van de 0 a ${MAX_XP}.`;
    else sheetSet.xp = xp;
  }

  const portrait = await readImage(form.get("portrait"), MAX_IMAGE);
  const image = await readImage(form.get("image"), MAX_IMAGE);
  if (portrait.error) errors.portrait = portrait.error;
  if (image.error) errors.image = image.error;

  if (Object.keys(errors).length > 0) return invalid(errors);
  const writesSheet = Object.keys(sheetSet).length > 0;
  if (writesSheet && found.outdated) return fail(409, OUTDATED_SHEET_ERROR);

  // Todo es válido: se guardan las imágenes nuevas y, si el guardado va bien, se borran las sustituidas
  const created: unknown[] = []; // se borran si algo falla
  const replaced: unknown[] = []; // se borran si todo va bien
  try {
    const swap = async (
      field: "portraitId" | "imageId",
      next: { data: Buffer; contentType: string } | undefined,
      remove: boolean,
    ) => {
      if (!next && !remove) return;
      if (character[field]) replaced.push(character[field]);
      if (next) {
        const newId = await storeImage(next, userId);
        created.push(newId);
        set[field] = newId;
      } else unset[field] = "";
    };
    await swap("portraitId", portrait.image, text(form.get("removePortrait")) === "true");
    await swap("imageId", image.image, text(form.get("removeImage")) === "true");

    // Solo los campos que cambian (`sheet.notes`…), para no pisar otros cambios de la hoja hechos a la vez
    const toSet = { ...set, ...Object.fromEntries(Object.entries(sheetSet).map(([k, v]) => [`sheet.${k}`, v])) };
    const update = {
      ...(Object.keys(toSet).length ? { $set: toSet } : {}),
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    };
    if (Object.keys(update).length) {
      const res = await Character.updateOne({ _id: id, ...(writesSheet ? { "sheet.version": 2 } : {}) }, update);
      // La hoja cambió de versión entre la carga y el guardado
      if (res.matchedCount === 0) {
        if (created.length) await CampaignImage.deleteMany({ _id: { $in: created } });
        return fail(409, OUTDATED_SHEET_ERROR);
      }
    }
  } catch (err) {
    if (created.length) await CampaignImage.deleteMany({ _id: { $in: created } });
    console.error("Error al editar el personaje:", err);
    return fail(500, "No se pudo guardar el personaje. Inténtalo de nuevo.");
  }
  if (replaced.length) await CampaignImage.deleteMany({ _id: { $in: replaced } });
  return { ok: true };
}

// Borra el personaje, sus avisos y sus imágenes
export async function deleteCharacter(userId: string, id: string): Promise<Result> {
  const found = await loadCharacterFor(userId, id, "write");
  if (!found) return notFound();
  const { character } = found;

  try {
    // Los avisos de subida de nivel enlazan a la ficha: se borran antes, para que un fallo no los deje colgando
    await Notification.deleteMany({ character: id });
    await Character.deleteOne({ _id: id, owner: userId });
    const images = [character.portraitId, character.imageId].filter(Boolean);
    if (images.length) await CampaignImage.deleteMany({ _id: { $in: images } });
    return { ok: true };
  } catch (err) {
    console.error("Error al borrar el personaje:", err);
    return fail(500, "No se pudo borrar el personaje. Inténtalo de nuevo.");
  }
}
