import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { loadCharacterFor } from "@/lib/characterAccess";
import { resolveRef } from "@/lib/rules/catalog";
import { spellClassNames } from "@/lib/rules/dnd2024/spellText";
import type { SpellData } from "@/lib/rules/types";

type Ctx = { params: Promise<{ id: string; bookId: string; key: string }> };

// Las claves llevan ":" y "|". Next entrega el parámetro ya decodificado; si llegara codificado (sin ":"), se decodifica
function decodeKey(raw: string): string | null {
  if (raw.includes(":") || !raw.includes("%")) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

const notFound = () => NextResponse.json({ error: "Conjuro no disponible." }, { status: 404 });

// Ficha completa de un conjuro para la pestaña Conjuros: quien puede ver el personaje (dueño o miembro de su campaña)
// la recibe solo si el conjuro es de los libros del personaje (no de los de quien mira), con sus clases en español.
export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("character_read", session.id, 600, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const { id, bookId, key: rawKey } = await params;
  const key = decodeKey(rawKey);
  if (!key || !key.startsWith("spell:")) return notFound();
  const found = await loadCharacterFor(session.id, id, "read");
  if (!found) return NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });

  const entry = await resolveRef({ book: bookId, key }, found.books);
  if (!entry) return notFound();
  // Las clases en español van aparte: la ficha del conjuro (cliente) no carga `es.json`
  return NextResponse.json({ entry, classNames: spellClassNames((entry.data as SpellData | null)?.classes ?? []) });
}
