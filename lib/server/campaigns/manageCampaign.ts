import "server-only";
// Crear, editar y borrar una campaña. Editar y borrar solo puede el DM: la campaña se busca con su id como dueño, y
// si no lo es, es como si no existiera (404).
import mongoose from "mongoose";
import { connectDB } from "@/lib/models/mongodb";
import { Campaign } from "@/lib/models/Campaign";
import { CampaignImage } from "@/lib/models/CampaignImage";
import { User } from "@/lib/models/User";
import { booksByIds, visibleBooksOf } from "@/lib/server/catalog/books";
import { parseCampaignForm, storeImage } from "@/lib/server/campaigns/campaignInput";
import { deleteCampaignData } from "@/lib/server/account/accountCleanup";
import { fail, invalid, type Result } from "@/lib/server/result";

const notFound = () => fail(404, "Campaña no encontrada.");

export async function createCampaign(userId: string, form: FormData): Promise<Result<{ id: string }>> {
  await connectDB();
  const me = await User.findById(userId).select("_id");
  if (!me) return fail(401, "Inicia sesión para crear una campaña.");

  const parsed = await parseCampaignForm(form, {
    visibleBooks: await visibleBooksOf(userId),
  });
  if (Object.keys(parsed.errors).length > 0) return invalid(parsed.errors);

  // Todo es válido: se guardan las imágenes y la campaña. Si algo falla, se borran las imágenes huérfanas.
  const created: unknown[] = [];
  try {
    let imageId, logoId;
    if (parsed.image) {
      imageId = await storeImage(parsed.image, userId);
      created.push(imageId);
    }
    if (parsed.logo) {
      logoId = await storeImage(parsed.logo, userId);
      created.push(logoId);
    }

    const campaign = await Campaign.create({
      ...parsed.value,
      owner: userId,
      members: [userId],
      imageId,
      logoId,
    });
    return { ok: true, id: (campaign._id as mongoose.Types.ObjectId).toString() };
  } catch (err) {
    if (created.length) await CampaignImage.deleteMany({ _id: { $in: created } });
    console.error("Error al crear la campaña:", err);
    return fail(500, "No se pudo crear la campaña. Inténtalo de nuevo.");
  }
}

export async function updateCampaign(userId: string, id: string, form: FormData): Promise<Result> {
  await connectDB();
  // El filtro por owner garantiza que solo el DM llega aquí. Las notas privadas se piden expresamente.
  const campaign = await Campaign.findOne({
    _id: id,
    owner: userId,
  }).select("+privateNotes");
  if (!campaign) return notFound();

  // Los libros que ya estaban aprobados se pueden conservar aunque ya no sean visibles para el DM
  const visibleBooks = [
    ...(await visibleBooksOf(userId)),
    ...(await booksByIds((campaign.allowedBooks ?? []) as string[])),
  ];
  const parsed = await parseCampaignForm(form, {
    visibleBooks,
    lockedSystemId: campaign.systemId, // el sistema no se puede cambiar
  });
  if (Object.keys(parsed.errors).length > 0) return invalid(parsed.errors);

  const created: unknown[] = []; // imágenes nuevas (se borran si algo falla)
  const replaced: unknown[] = []; // imágenes antiguas (se borran si todo va bien)
  try {
    if (parsed.image) {
      const newId = await storeImage(parsed.image, userId);
      created.push(newId);
      if (campaign.imageId) replaced.push(campaign.imageId);
      campaign.imageId = newId;
    } else if (parsed.removeImage && campaign.imageId) {
      replaced.push(campaign.imageId);
      campaign.imageId = undefined;
    }

    if (parsed.logo) {
      const newId = await storeImage(parsed.logo, userId);
      created.push(newId);
      if (campaign.logoId) replaced.push(campaign.logoId);
      campaign.logoId = newId;
    } else if (parsed.removeLogo && campaign.logoId) {
      replaced.push(campaign.logoId);
      campaign.logoId = undefined;
    }

    campaign.set(parsed.value);
    await campaign.save(); // también actualiza updatedAt
  } catch (err) {
    if (created.length) await CampaignImage.deleteMany({ _id: { $in: created } });
    console.error("Error al editar la campaña:", err);
    return fail(500, "No se pudo guardar la campaña. Inténtalo de nuevo.");
  }

  if (replaced.length) {
    try {
      await CampaignImage.deleteMany({ _id: { $in: replaced } });
    } catch (err) {
      console.error("No se pudieron borrar las imágenes antiguas:", err); // solo quedan huérfanas
    }
  }
  return { ok: true };
}

/* Hay que enviar el nombre exacto de la campaña. Se borran la campaña, su homebrew y sus imágenes (deleteCampaignData).
   Los personajes NO se borran: se quedan sin campaña. */
export async function deleteCampaign(userId: string, id: string, confirmName: string): Promise<Result> {
  await connectDB();
  const campaign = await Campaign.findOne({
    _id: id,
    owner: userId,
  }).select("name imageId logoId");
  if (!campaign) return notFound();

  // La confirmación se comprueba en el servidor, no solo en el navegador
  if (confirmName !== String(campaign.name).trim())
    return fail(400, "El nombre escrito no coincide con el de la campaña.");

  try {
    await deleteCampaignData(campaign);
    return { ok: true };
  } catch (err) {
    console.error("Error al borrar la campaña:", err);
    return fail(500, "No se pudo borrar la campaña. Inténtalo de nuevo.");
  }
}
