import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Campaign } from "@/lib/Campaign";
import { CampaignImage } from "@/lib/CampaignImage";
import { User } from "@/lib/User";
import { visibleBooksOf } from "@/lib/rules/books";
import { parseCampaignForm, storeImage } from "@/lib/campaignInput";

export async function POST(req: NextRequest) {
  // La sesión se comprueba aquí: no basta con que la página esté protegida
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json(
      { error: "Inicia sesión para crear una campaña." },
      { status: 401 },
    );
  }

  // Máximo 10 campañas por hora y por usuario
  const limited = await rateLimit("campaign_create", session.id, 10, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  await connectDB();
  const me = await User.findById(session.id).select("_id");
  if (!me)
    return NextResponse.json(
      { error: "Inicia sesión para crear una campaña." },
      { status: 401 },
    );

  const parsed = await parseCampaignForm(form, {
    visibleBooks: await visibleBooksOf(session.id),
  });
  if (Object.keys(parsed.errors).length > 0) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  // Todo es válido: se guardan las imágenes y la campaña. Si algo falla, se borran las imágenes huérfanas.
  const created: unknown[] = [];
  try {
    let imageId, logoId;
    if (parsed.image) {
      imageId = await storeImage(parsed.image, session.id);
      created.push(imageId);
    }
    if (parsed.logo) {
      logoId = await storeImage(parsed.logo, session.id);
      created.push(logoId);
    }

    const campaign = await Campaign.create({
      ...parsed.value,
      owner: session.id,
      members: [session.id],
      imageId,
      logoId,
    });

    return NextResponse.json(
      { id: (campaign._id as mongoose.Types.ObjectId).toString() },
      { status: 201 },
    );
  } catch (err) {
    if (created.length)
      await CampaignImage.deleteMany({ _id: { $in: created } });
    console.error("Error al crear la campaña:", err);
    return NextResponse.json(
      { error: "No se pudo crear la campaña. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
