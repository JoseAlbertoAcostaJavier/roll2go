import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Campaign } from "@/lib/Campaign";
import { Character } from "@/lib/Character";
import { requireMember } from "@/lib/campaignApi";

/* DELETE: el DM expulsa a un jugador, o un jugador se va él mismo.
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

  try {
    const result = await Campaign.updateOne(
      { _id: ctx.campaign._id, members: userId },
      { $pull: { members: userId } },
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
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al quitar al participante:", err);
    return NextResponse.json(
      { error: "No se pudo completar la acción. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
