import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { detectImageType } from "@/lib/server/account/images";
import { updateProfile } from "@/lib/server/account/profile";
import { failureResponse } from "@/lib/server/result";

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

  const result = await updateProfile(
    session.id,
    { displayName, pronouns, location, bio },
    newAvatar,
    text(form.get("removeAvatar")) === "true",
  );
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
