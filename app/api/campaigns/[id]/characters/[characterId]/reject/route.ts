import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireDm } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Character } from "@/lib/Character";
import { notify } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string; characterId: string }> };

// POST: el DM deniega la solicitud de un personaje, que sale de la campaña (sigue existiendo). Solo si sigue pendiente (si no, 409).
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id, characterId } = await params;
  const ctx = await requireDm(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("campaign_characters", ctx.session.id, 60, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const notPending = NextResponse.json({ error: "La solicitud ya no está pendiente." }, { status: 409 });
  if (!mongoose.isValidObjectId(characterId)) return notPending;
  const filter = { _id: characterId, campaign: ctx.campaign._id, campaignStatus: "pending" };
  const character = await Character.findOne(filter).select("name owner campaignStatus").lean();
  if (!character || character.campaignStatus !== "pending") return notPending;

  // Condicional: si el jugador la acaba de cancelar, no cambia nada
  const result = await Character.updateOne(filter, { $unset: { campaign: "", origin: "", campaignStatus: "" } });
  if (result.matchedCount === 0) return notPending;

  if (String(character.owner) !== ctx.session.id) {
    try {
      await notify({
        user: String(character.owner),
        type: "character_rejected",
        actor: ctx.session.id,
        campaign: id,
        character: characterId,
        text: character.name,
      });
    } catch (err) {
      console.error("No se pudo avisar al jugador de la denegación:", err);
    }
  }
  return NextResponse.json({ ok: true });
}
