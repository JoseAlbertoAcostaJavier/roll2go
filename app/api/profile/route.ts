import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { User } from "@/lib/User";
import { CampaignImage } from "@/lib/CampaignImage";
import { storeImage } from "@/lib/campaignInput";
import { detectImageType } from "@/lib/images";

const MAX_AVATAR = 512 * 1024; // el navegador ya la reduce a 256x256, así que pesa muy poco

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
// Campos de una línea: sin saltos ni caracteres de control
const oneLine = (s: string) => s.replace(/[\u0000-\u001F\u007F]/g, "").trim();
// Biografía: permite saltos de línea, pero no otros caracteres de control
const multiLine = (s: string) =>
  s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim();

export async function PATCH(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("profile_edit", session.id, 20, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const displayName = oneLine(text(form.get("displayName")));
  const pronouns = oneLine(text(form.get("pronouns")));
  const location = oneLine(text(form.get("location")));
  const bio = multiLine(text(form.get("bio")));

  const errors: Record<string, string> = {};
  if (displayName.length > 40) errors.displayName = "Máximo 40 caracteres.";
  if (pronouns.length > 30) errors.pronouns = "Máximo 30 caracteres.";
  if (location.length > 60) errors.location = "Máximo 60 caracteres.";
  if (bio.length > 500) errors.bio = "Máximo 500 caracteres.";

  let newAvatar: { data: Buffer; contentType: string } | undefined;
  const entry = form.get("avatar");
  if (entry instanceof File && entry.size > 0) {
    if (entry.size > MAX_AVATAR) errors.avatar = "La foto es demasiado grande.";
    else {
      const data = Buffer.from(await entry.arrayBuffer());
      const contentType = detectImageType(data); // se mira el contenido real, no el nombre
      if (!contentType) errors.avatar = "Usa una imagen PNG, JPG o WebP.";
      else newAvatar = { data, contentType };
    }
  }
  if (Object.keys(errors).length > 0)
    return NextResponse.json({ errors }, { status: 400 });

  await connectDB();
  const user = await User.findById(session.id).select("avatarId");
  if (!user)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const set: Record<string, unknown> = { displayName, pronouns, location, bio };
  const unset: Record<string, ""> = {};
  let createdId: unknown;
  let oldAvatar: unknown;

  try {
    if (newAvatar) {
      createdId = await storeImage(newAvatar, session.id);
      oldAvatar = user.avatarId;
      set.avatarId = createdId;
    } else if (text(form.get("removeAvatar")) === "true" && user.avatarId) {
      oldAvatar = user.avatarId;
      unset.avatarId = "";
    }
    await User.updateOne(
      { _id: user._id },
      Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set },
    );
  } catch (err) {
    if (createdId) await CampaignImage.deleteOne({ _id: createdId });
    console.error("Error al guardar el perfil:", err);
    return NextResponse.json(
      { error: "No se pudo guardar el perfil. Inténtalo de nuevo." },
      { status: 500 },
    );
  }

  if (oldAvatar) {
    try {
      await CampaignImage.deleteOne({ _id: oldAvatar });
    } catch (err) {
      console.error("No se pudo borrar la foto antigua:", err);
    }
  }
  return NextResponse.json({ ok: true });
}
