import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { cleanText } from "@/lib/utils";
import { system as rpgSystems } from "@/lib/systems";
import { Campaign } from "@/lib/Campaign";
import { CampaignImage } from "@/lib/CampaignImage";
import { Character } from "@/lib/Character";
import { notify } from "@/lib/notify";
import { MAX_IMAGE, readImage, storeImage } from "@/lib/campaignInput";
import { NotFoundError, resolveRef, usableBooks } from "@/lib/rules/catalog";
import { validateSheet } from "@/lib/rules/dnd2024/validate";
import { ALIGNMENTS } from "@/lib/rules/dnd2024/alignments";

const STATUSES = ["active", "retired", "dead"] as const;
const MAX_NAME = 80;
const MAX_BACKSTORY = 100000;
const MAX_BOOKS = 50;

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const notFound = () => NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

// Crea un personaje: multipart/form-data con `sheet` (JSON), `system`, `name`, `status`, `campaign`, `books`,
// `backstory`, `portrait` e `image`. Responde 201 { id } o 400 { errors } con los errores por campo.
export async function POST(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("character_create", session.id, 30, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const systemId = text(form.get("system"));
  if (!rpgSystems.some((s) => s.id === systemId && s.creator))
    return NextResponse.json({ error: "Sistema de juego no disponible." }, { status: 400 });

  const errors: Record<string, string> = {};
  const name = cleanText(text(form.get("name"))).trim();
  if (!name) errors.name = "Escribe un nombre.";
  else if (name.length > MAX_NAME) errors.name = `Máximo ${MAX_NAME} caracteres.`;
  const status = text(form.get("status")) as (typeof STATUSES)[number];
  if (!STATUSES.includes(status)) errors.status = "Estado no válido.";
  const backstory = cleanText(text(form.get("backstory")));
  if (backstory.length > MAX_BACKSTORY) errors.backstory = "La historia es demasiado larga.";

  // Campaña: hay que ser miembro (si no, 404) y que admita personajes internos del mismo sistema
  await connectDB();
  const campaignId = text(form.get("campaign"));
  let campaign: { _id: unknown; owner: unknown; restrictBooks?: boolean } | null = null;
  if (campaignId) {
    if (!mongoose.isValidObjectId(campaignId)) return notFound();
    const doc = await Campaign.findOne({ _id: campaignId, members: session.id })
      .select("owner systemId restrictBooks characters")
      .lean();
    if (!doc) return notFound();
    if (doc.systemId !== systemId) errors.campaign = "La campaña es de otro sistema de juego.";
    else if (!doc.characters?.allowed || !doc.characters?.internal)
      errors.campaign = "Esta campaña no admite personajes creados desde Roll2Go.";
    campaign = doc;
  }

  // Libros: el servidor recalcula los permitidos; lo que no se pueda usar se ignora
  const chosen = text(form.get("books")).split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_BOOKS);
  let books: string[];
  try {
    books = await usableBooks({ userId: session.id, systemId, campaignId: campaignId || undefined, chosenBooks: chosen });
  } catch (e) {
    if (e instanceof NotFoundError) return notFound();
    throw e;
  }

  let rawSheet: unknown = null;
  try {
    rawSheet = JSON.parse(text(form.get("sheet")) || "null");
  } catch {
    // JSON mal formado: validateSheet lo rechaza como hoja no válida
  }
  const result = await validateSheet(rawSheet, {
    userId: session.id,
    books,
    resolve: (ref) => resolveRef(ref, books),
  });
  if (!result.ok) Object.assign(errors, result.errors);
  else if (result.sheet.alignment && !ALIGNMENTS.some((a) => a.id === result.sheet.alignment))
    errors.alignment = "Alineamiento no válido.";

  const portrait = await readImage(form.get("portrait"), MAX_IMAGE);
  const image = await readImage(form.get("image"), MAX_IMAGE);
  if (portrait.error) errors.portrait = portrait.error;
  if (image.error) errors.image = image.error;

  if (Object.keys(errors).length > 0 || !result.ok) return NextResponse.json({ errors }, { status: 400 });

  // Todo es válido: se guardan las imágenes y el personaje. Si algo falla, se borran las imágenes huérfanas.
  const created: unknown[] = [];
  let id: string;
  try {
    let portraitId, imageId;
    if (portrait.image) {
      portraitId = await storeImage(portrait.image, session.id);
      created.push(portraitId);
    }
    if (image.image) {
      imageId = await storeImage(image.image, session.id);
      created.push(imageId);
    }
    const character = await Character.create({
      owner: session.id,
      name,
      systemId,
      // Solo se guarda el filtro propio del personaje; si manda el de la campaña, no hace falta
      books: chosen.length > 0 && !campaign?.restrictBooks ? books : [],
      ...(campaign ? { campaign: campaign._id, origin: "internal" } : {}),
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
    return NextResponse.json({ error: "No se pudo crear el personaje. Inténtalo de nuevo." }, { status: 500 });
  }

  // Aviso al DM (si no es quien lo crea). Un fallo aquí no deshace la creación.
  if (campaign && String(campaign.owner) !== session.id) {
    try {
      await notify({
        user: String(campaign.owner),
        type: "character_created",
        actor: session.id,
        campaign: String(campaign._id),
      });
    } catch (err) {
      console.error("No se pudo avisar al DM del nuevo personaje:", err);
    }
  }

  return NextResponse.json({ id }, { status: 201 });
}
