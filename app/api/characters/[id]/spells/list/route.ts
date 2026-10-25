import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { loadCharacterFor } from "@/lib/server/characters/characterAccess";
import { listSpellRows } from "@/lib/server/catalog/catalog";
import { SPELL_LIST_CACHE, validList } from "@/lib/rules/catalog/spellRows";

type Ctx = { params: Promise<{ id: string }> };

// Conjuros de una lista de clase en filas ligeras, para el asistente de subir de nivel y la pestaña Conjuros (spec
// ampliación de conjuros §5): de los libros del personaje, para quien puede verlo (el DM ve también los de los libros
// privados del jugador).
export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("character_read", session.id, 600, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const list = req.nextUrl.searchParams.get("list");
  if (!validList(list)) return NextResponse.json({ error: "Lista no válida." }, { status: 400 });
  const { id } = await params;
  const found = await loadCharacterFor(session.id, id, "read");
  if (!found) return NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });

  return NextResponse.json({ spells: await listSpellRows(found.books, list) }, { headers: SPELL_LIST_CACHE });
}
