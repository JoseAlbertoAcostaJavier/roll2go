import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { connectDB } from "@/lib/mongodb";
import { Book } from "@/lib/Book";
import { Campaign } from "@/lib/Campaign";
import { Character } from "@/lib/Character";
import { canRequestJoin } from "@/lib/CampaignRules";
import { OUTDATED_SHEET_ERROR, loadCharacterFor } from "@/lib/characterAccess";
import { booksUsedBy } from "@/lib/rules/dnd2024/booksUsed";
import { notify } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });

/* POST { campaignId }: el dueño solicita unir su personaje a una campaña. Queda pendiente hasta que el DM lo acepte
   (si quien lo pide es el DM, se aprueba al momento). Responde { status: "pending" | "approved" }. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("campaign_characters", session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const body = await req.json().catch(() => null);
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";
  if (!mongoose.isValidObjectId(campaignId))
    return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  // "write": solo el dueño, y una hoja v1 se convierte antes (si no se puede, no se une)
  const found = await loadCharacterFor(session.id, id, "write");
  if (!found) return notFound();
  if (found.outdated) return NextResponse.json({ error: OUTDATED_SHEET_ERROR }, { status: 409 });

  await connectDB();
  const campaign = await Campaign.findById(campaignId)
    .select("name owner members systemId status characters restrictBooks allowedBooks")
    .lean();
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  const rule = canRequestJoin({
    campaign: {
      systemId: campaign.systemId,
      status: campaign.status,
      characters: { allowed: !!campaign.characters?.allowed, external: !!campaign.characters?.external },
      restrictBooks: !!campaign.restrictBooks,
      allowedBooks: campaign.allowedBooks ?? [],
    },
    character: {
      systemId: found.character.systemId,
      campaign: found.character.campaign ? String(found.character.campaign) : null,
      // Los libros que usa de verdad la hoja (Character.books es solo el filtro del creador y puede estar vacío)
      books: booksUsedBy(found.sheet),
    },
    isMember: (campaign.members ?? []).some((m: unknown) => String(m) === session.id),
  });
  if (!rule.ok) {
    if (!rule.disallowed?.length) return NextResponse.json({ error: rule.error }, { status: 400 });
    // Se nombran los libros no permitidos (si alguno ya no existe, se muestra su id)
    const books = await Book.find({ _id: { $in: rule.disallowed.filter((b) => mongoose.isValidObjectId(b)) } })
      .select("name")
      .lean();
    const names = new Map(books.map((b: { _id: unknown; name: string }) => [String(b._id), b.name]));
    const list = rule.disallowed.map((b) => names.get(b) ?? b).join(", ");
    return NextResponse.json({ error: `Este personaje usa libros que la campaña no permite: ${list}.` }, { status: 400 });
  }

  const isDm = String(campaign.owner) === session.id;
  const status = isDm ? "approved" : "pending";
  // Condicional: si otra solicitud se adelantó (a esta u otra campaña), no se pisa
  const result = await Character.updateOne(
    { _id: id, owner: session.id, campaign: { $exists: false } },
    { $set: { campaign: campaignId, origin: "external", campaignStatus: status } },
  );
  if (result.matchedCount === 0)
    return NextResponse.json({ error: "Este personaje ya está en una campaña." }, { status: 409 });

  if (!isDm) {
    try {
      await notify({
        user: String(campaign.owner),
        type: "character_import_request",
        actor: session.id,
        campaign: campaignId,
        character: id,
        text: found.character.name,
      });
    } catch (err) {
      console.error("No se pudo avisar al DM de la solicitud:", err);
    }
  }
  return NextResponse.json({ status });
}

/* DELETE: el dueño saca su personaje de la campaña o cancela su solicitud. Si estaba aprobado, se avisa al DM
   (salvo que el dueño sea el propio DM). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("campaign_characters", session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  if (!mongoose.isValidObjectId(id)) return notFound();
  await connectDB();
  const character = await Character.findOne({ _id: id, owner: session.id })
    .select("name campaign campaignStatus")
    .lean();
  if (!character) return notFound();
  if (!character.campaign)
    return NextResponse.json({ error: "Este personaje no está en ninguna campaña." }, { status: 409 });

  // Los antiguos sin campaignStatus cuentan como aprobados
  const wasPending = character.campaignStatus === "pending";
  // Solo si sigue como se leyó (si el DM lo acaba de aceptar o quitar, se recarga)
  const result = await Character.updateOne(
    {
      _id: id,
      owner: session.id,
      campaign: character.campaign,
      campaignStatus: wasPending ? "pending" : { $ne: "pending" },
    },
    { $unset: { campaign: "", origin: "", campaignStatus: "" } },
  );
  if (result.matchedCount === 0)
    return NextResponse.json({ error: "El personaje ha cambiado; recarga la página." }, { status: 409 });

  if (!wasPending) {
    try {
      const campaign = await Campaign.findById(character.campaign).select("owner").lean();
      if (campaign && String(campaign.owner) !== session.id) {
        await notify({
          user: String(campaign.owner),
          type: "character_left",
          actor: session.id,
          campaign: String(character.campaign),
          character: id,
          text: character.name,
        });
      }
    } catch (err) {
      console.error("No se pudo avisar al DM de la salida del personaje:", err);
    }
  }
  return NextResponse.json({ ok: true });
}
