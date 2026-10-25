import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { NotFoundError, listSpellRows, usableBooks } from "@/lib/rules/catalog";
import { SPELL_LIST_CACHE, validList } from "@/lib/rules/spellRows";

// Conjuros de una lista de clase en filas ligeras, para el creador (spec ampliación de conjuros §5): de los libros que
// el usuario puede usar en el sistema (con la campaña, los que admite), acotados a los elegidos.
export async function GET(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("rules_read", session.id, 600, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const sp = req.nextUrl.searchParams;
  const list = sp.get("list");
  const systemId = sp.get("system") ?? "";
  if (!validList(list) || !systemId) return NextResponse.json({ error: "Lista no válida." }, { status: 400 });
  const chosen = (sp.get("books") ?? "").slice(0, 2000).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);

  try {
    const books = await usableBooks({
      userId: session.id,
      systemId,
      campaignId: sp.get("campaign") || undefined,
      chosenBooks: chosen,
    });
    return NextResponse.json({ spells: await listSpellRows(books, list) }, { headers: SPELL_LIST_CACHE });
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
