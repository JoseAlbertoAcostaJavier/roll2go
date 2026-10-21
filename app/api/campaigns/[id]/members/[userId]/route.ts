import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Campaign } from "@/lib/Campaign";
import { CampaignLogEntry } from "@/lib/CampaignLogEntry";
import { Character } from "@/lib/Character";
import { requireMember } from "@/lib/campaignApi";
import { notify } from "@/lib/notify";

/* DELETE: el DM expulsa a un jugador, o un jugador se va él mismo.
   ?ban=1 (solo el DM) añade además a la persona a la lista de bloqueados de la campaña.
   El DM no puede irse ni ser expulsado (tendría que borrar la campaña). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  const ctx = await requireMember(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("members", ctx.session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  if (!mongoose.isValidObjectId(userId)) {
    return NextResponse.json(
      { error: "Participante no encontrado." },
      { status: 404 },
    );
  }
  if (String(ctx.campaign.owner) === userId) {
    return NextResponse.json(
      {
        error:
          "El DM no puede abandonar su campaña ni ser expulsado. Para cerrarla, bórrala.",
      },
      { status: 400 },
    );
  }
  const isSelf = userId === ctx.session.id;
  if (!isSelf && !ctx.isDm) {
    return NextResponse.json(
      { error: "Solo el DM puede expulsar a un participante." },
      { status: 403 },
    );
  }
  const ban =
    ctx.isDm && !isSelf && req.nextUrl.searchParams.get("ban") === "1";

  try {
    const result = await Campaign.updateOne(
      { _id: ctx.campaign._id, members: userId },
      ban
        ? { $pull: { members: userId }, $addToSet: { banned: userId } }
        : { $pull: { members: userId } },
    );
    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: "Participante no encontrado." },
        { status: 404 },
      );
    }
    // Sus personajes siguen existiendo, pero sin campaña
    await Character.updateMany(
      { campaign: ctx.campaign._id, owner: userId },
      { $unset: { campaign: "", origin: "" } },
    );

    if (!isSelf) {
      try {
        await notify({
          user: userId,
          type: "campaign_removed",
          actor: ctx.session.id,
          campaign: id,
        });
      } catch (err) {
        console.error("No se pudo avisar al expulsado:", err);
      }
    }

    // Sus notas se mantienen. Se devuelve cuántas son para que el DM decida si borrarlas.
    const notes = await CampaignLogEntry.countDocuments({
      campaign: ctx.campaign._id,
      author: userId,
    });
    return NextResponse.json({ ok: true, notes });
  } catch (err) {
    console.error("Error al quitar al participante:", err);
    return NextResponse.json(
      { error: "No se pudo completar la acción. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
