import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Campaign } from "@/lib/Campaign";
import { CampaignImage } from "@/lib/CampaignImage";
import { User } from "@/lib/User";
import { parseCampaignForm, storeImage } from "@/lib/campaignInput";
import { deleteCampaignData } from "@/lib/accountCleanup";
type Ctx = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

// EDITAR: solo el DM (owner) puede modificar la campaña
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  if (!mongoose.isValidObjectId(id)) return notFound();

  // Máximo 30 ediciones por hora y por usuario
  const limited = await rateLimit("campaign_edit", session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  await connectDB();
  // El filtro por owner garantiza que solo el DM llega aquí. Las notas privadas se piden expresamente.
  const campaign = await Campaign.findOne({
    _id: id,
    owner: session.id,
  }).select("+privateNotes");
  if (!campaign) return notFound();

  // Los libros que ya estaban aprobados se pueden conservar aunque el DM ya no los tenga en su perfil
  const me = await User.findById(session.id).select("ownedBooks");
  const parsed = await parseCampaignForm(form, {
    ownedBooks: [...(me?.ownedBooks ?? []), ...(campaign.allowedBooks ?? [])],
    lockedSystemId: campaign.systemId, // el sistema no se puede cambiar
  });
  if (Object.keys(parsed.errors).length > 0) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  const created: unknown[] = []; // imágenes nuevas (se borran si algo falla)
  const replaced: unknown[] = []; // imágenes antiguas (se borran si todo va bien)
  try {
    if (parsed.image) {
      const newId = await storeImage(parsed.image, session.id);
      created.push(newId);
      if (campaign.imageId) replaced.push(campaign.imageId);
      campaign.imageId = newId;
    } else if (parsed.removeImage && campaign.imageId) {
      replaced.push(campaign.imageId);
      campaign.imageId = undefined;
    }

    if (parsed.logo) {
      const newId = await storeImage(parsed.logo, session.id);
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
    if (created.length)
      await CampaignImage.deleteMany({ _id: { $in: created } });
    console.error("Error al editar la campaña:", err);
    return NextResponse.json(
      { error: "No se pudo guardar la campaña. Inténtalo de nuevo." },
      { status: 500 },
    );
  }

  if (replaced.length) {
    try {
      await CampaignImage.deleteMany({ _id: { $in: replaced } });
    } catch (err) {
      console.error("No se pudieron borrar las imágenes antiguas:", err); // solo quedan huérfanas
    }
  }
  return NextResponse.json({ id });
}

/* BORRAR: solo el DM, y tiene que enviar el nombre exacto de la campaña.
   Se borran la campaña, su homebrew y sus imágenes. Los personajes NO se borran: se quedan sin campaña. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  if (!mongoose.isValidObjectId(id)) return notFound();

  const limited = await rateLimit("campaign_delete", session.id, 10, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { confirmName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  const confirmName =
    typeof body.confirmName === "string" ? body.confirmName.trim() : "";

  await connectDB();
  const campaign = await Campaign.findOne({
    _id: id,
    owner: session.id,
  }).select("name imageId logoId");
  if (!campaign) return notFound();

  // La confirmación se comprueba en el servidor, no solo en el navegador
  if (confirmName !== String(campaign.name).trim()) {
    return NextResponse.json(
      { error: "El nombre escrito no coincide con el de la campaña." },
      { status: 400 },
    );
  }

  try {
    await deleteCampaignData(campaign);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al borrar la campaña:", err);
    return NextResponse.json(
      { error: "No se pudo borrar la campaña. Inténtalo de nuevo." },
      { status: 500 },
    );
  }

  // 4. Las imágenes se borran al final: si esto falla, solo quedan imágenes huérfanas sin campaña
  const imageIds = [campaign.imageId, campaign.logoId].filter(Boolean);
  if (imageIds.length) {
    try {
      await CampaignImage.deleteMany({ _id: { $in: imageIds } });
    } catch (err) {
      console.error("No se pudieron borrar las imágenes de la campaña:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
