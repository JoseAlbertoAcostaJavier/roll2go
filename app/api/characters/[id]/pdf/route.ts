import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { loadCharacterFor } from "@/lib/server/characters/characterAccess";
import { listActions, listSpells } from "@/lib/server/catalog/catalog";
import { fillSheetPdf } from "@/lib/server/characters/sheetPdf";
import { derive } from "@/lib/rules/dnd2024/derive";
import { deriveActions, withSpellEntries } from "@/lib/rules/dnd2024/derive/actions";
import { itemActions } from "@/lib/rules/dnd2024/sheet/itemActions";
import { sheetPdfValues } from "@/lib/rules/dnd2024/sheet/pdfValues";
import { hitDicePools } from "@/lib/rules/dnd2024/sheet/rest";

type Ctx = { params: Promise<{ id: string }> };

// La ficha del personaje en PDF, sobre la plantilla, para quien puede verla
export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("character_pdf", session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const { id } = await params;
  const found = await loadCharacterFor(session.id, id, "read");
  if (!found) return NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });
  const { character, sheet, entries, books } = found;

  const derived = derive(sheet, entries);
  const [spellOptions, basics] = await Promise.all([derived.hasSpells ? listSpells(books) : Promise.resolve([]), listActions(books)]);
  const full = withSpellEntries(entries, spellOptions);
  const actions = deriveActions({
    attacks: derived.attacks, spells: derived.spells, features: derived.features, featureUses: derived.featureUses, basics, entries: full,
    level: derived.level,
  });

  const pdf = await fillSheetPdf(sheetPdfValues({
    name: character.name,
    backstory: character.backstory ?? "",
    sheet,
    derived,
    entries: full,
    pools: hitDicePools(sheet, entries),
    actions: actions.items,
    itemActions: itemActions(sheet.inventory.items, entries),
  }));

  const filename = encodeURIComponent(`${character.name}.pdf`);
  return new NextResponse(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename*=UTF-8''${filename}`, "Cache-Control": "private, no-store" },
  });
}
