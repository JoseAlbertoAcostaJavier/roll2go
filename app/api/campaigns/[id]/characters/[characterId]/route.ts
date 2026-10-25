import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireDm } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { Character } from "@/lib/models/Character";
import { notify } from "@/lib/server/notifications/notify";
import { Notification } from "@/lib/models/Notification";

type Ctx = { params: Promise<{ id: string; characterId: string }> };

// DELETE: el DM saca un personaje (aprobado o pendiente) de la campaña. El personaje sigue existiendo para su dueño.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id, characterId } = await params;
  const ctx = await requireDm(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("campaign_characters", ctx.session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const notFound = NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });
  if (!mongoose.isValidObjectId(characterId)) return notFound;
  const filter = { _id: characterId, campaign: ctx.campaign._id };
  const character = await Character.findOne(filter).select("name owner campaignStatus").lean();
  if (!character) return notFound;

  const result = await Character.updateOne(filter, { $unset: { campaign: "", origin: "", campaignStatus: "" } });
  if (result.matchedCount === 0) return notFound;

  // Si estaba pendiente, el aviso de la solicitud que recibió el DM ya no sirve
  if (character.campaignStatus === "pending") {
    await Notification.deleteMany({ type: "character_import_request", character: characterId, campaign: id })
      .catch((err: unknown) => console.error("No se pudo borrar el aviso de la solicitud:", err));
  }

  if (String(character.owner) !== ctx.session.id) {
    try {
      await notify({
        user: String(character.owner),
        type: "character_removed",
        actor: ctx.session.id,
        campaign: id,
        character: characterId,
        text: character.name,
      });
    } catch (err) {
      console.error("No se pudo avisar al jugador de que se quitó su personaje:", err);
    }
  }
  return NextResponse.json({ ok: true });
}
