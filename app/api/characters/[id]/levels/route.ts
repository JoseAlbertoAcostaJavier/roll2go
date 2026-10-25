import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { Campaign } from "@/lib/models/Campaign";
import { Character } from "@/lib/models/Character";
import { OUTDATED_SHEET_ERROR, loadCharacterFor } from "@/lib/server/characters/characterAccess";
import { notify } from "@/lib/server/notifications/notify";
import { getEntries, getEntry } from "@/lib/server/catalog/catalog";
import { derive } from "@/lib/rules/dnd2024/derive";
import { applyLevel, checkExpectedLevel } from "@/lib/rules/dnd2024/levels/levelOps";
import { loadSheetEntries } from "@/lib/rules/dnd2024/sheet/sheetEntries";
import { validateLevel } from "@/lib/rules/dnd2024/levels/validateLevel";

type Ctx = { params: Promise<{ id: string }> };

// Sube un nivel { expectedLevel, class, choices, hp }. Solo el dueño. Responde 201 { level } o 400 { errors } con los
// errores por campo; 409 si el personaje ya cambió de nivel. Avisa al DM si el personaje está en su campaña.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("character_level", session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const found = await loadCharacterFor(session.id, id, "write");
  if (!found) return NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });
  if (found.outdated) return NextResponse.json({ error: OUTDATED_SHEET_ERROR }, { status: 409 });

  const { sheet } = found;
  const before = sheet.levels.length;
  const expected = typeof body === "object" && body !== null ? (body as { expectedLevel?: unknown }).expectedLevel : undefined;
  const checked = checkExpectedLevel(expected, before);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: checked.status });

  const result = await validateLevel(sheet, body, {
    userId: session.id,
    characterId: id,
    books: found.books,
    resolve: async (ref) => (found.books.includes(ref.book) ? getEntry(ref) : null),
    entries: found.entries,
  });
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 });

  // Máximos de PG antes y después: el nuevo puede traer una clase, una subclase o una dote que cuente
  const maxBefore = derive(sheet, found.entries).hp.max;
  const draft = applyLevel(sheet, result.entry, maxBefore, maxBefore);
  const entriesAfter = await loadSheetEntries(draft, found.books, getEntries);
  const maxAfter = derive(draft, entriesAfter).hp.max;
  const next = applyLevel(sheet, result.entry, maxBefore, maxAfter);

  // Solo lo que cambia, y solo si nadie ha subido de nivel entretanto
  const set: Record<string, unknown> = { "sheet.classesSummary": next.classesSummary, "sheet.hp.current": next.hp.current };
  if (next.weaponMasteries) set["sheet.weaponMasteries"] = next.weaponMasteries;
  const res = await Character.updateOne(
    { _id: id, "sheet.version": 2, "sheet.levels": { $size: before } },
    { $set: set, $push: { "sheet.levels": result.entry } },
  );
  if (res.matchedCount === 0)
    return NextResponse.json({ error: "El personaje ha cambiado de nivel; recarga la página." }, { status: 409 });

  // Aviso al DM (si no es quien sube y quien sube sigue en la campaña). Un fallo aquí no deshace el nivel.
  const campaignId = found.character.campaign;
  if (campaignId) {
    try {
      const campaign = await Campaign.findById(campaignId).select("owner members").lean();
      const member = campaign?.members?.some((m: unknown) => String(m) === session.id);
      if (campaign && member && String(campaign.owner) !== session.id) {
        await notify({
          user: String(campaign.owner),
          type: "character_level_up",
          actor: session.id,
          campaign: String(campaignId),
          character: id,
          text: `${found.character.name} a nivel ${result.entry.n}`,
        });
      }
    } catch (err) {
      console.error("No se pudo avisar al DM de la subida de nivel:", err);
    }
  }

  return NextResponse.json({ level: result.entry }, { status: 201 });
}
