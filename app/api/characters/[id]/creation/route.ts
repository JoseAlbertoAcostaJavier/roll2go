import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { recreateCharacter } from "@/lib/server/characters/creation";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ id: string }> };

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

  const result = await recreateCharacter(session.id, id, form);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ id });
}
