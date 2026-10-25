import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { createCharacter } from "@/lib/server/characters/creation";
import { failureResponse } from "@/lib/server/result";

// Crea un personaje: multipart/form-data con `sheet` (JSON), `system`, `name`, `pronouns` («he,they»), `status`,
// `campaign`, `books`, `backstory`, `portrait` e `image`. Responde 201 { id } o 400 { errors } con los errores por campo.
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

  const result = await createCharacter(session.id, form);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ id: result.id }, { status: 201 });
}
