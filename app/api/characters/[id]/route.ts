import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { deleteCharacter, updateCharacter } from "@/lib/server/characters/editCharacter";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ id: string }> };

// Edita los datos del personaje (multipart/form-data, solo el dueño). Se cambia lo que llega: `name`, `pronouns`,
// `status`, `alignment`, `age`, `appearance`, `languages`, `backstory`, `notes`, `xp`, `portrait`, `image`, y las marcas
// `removePortrait` / `removeImage`. Mismos límites que el alta. Responde { ok: true } o 400 { errors }.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("character_edit", session.id, 300, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const result = await updateCharacter(session.id, id, form);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}

// Borra el personaje y sus imágenes (solo el dueño).
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("character_edit", session.id, 300, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const result = await deleteCharacter(session.id, id);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
