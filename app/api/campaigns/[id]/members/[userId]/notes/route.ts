import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { CampaignLogEntry } from "@/lib/CampaignLogEntry";
import { requireDm } from "@/lib/campaignApi";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  const ctx = await requireDm(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("members", ctx.session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  if (!mongoose.isValidObjectId(userId)) {
    return NextResponse.json(
      { error: "Participante no encontrado." },
      { status: 404 },
    );
  }
  // Solo para quien ya no está en la campaña: las notas de un participante activo se borran una a una
  if (ctx.campaign.members.some((m) => String(m) === userId)) {
    return NextResponse.json(
      { error: "Esta persona sigue en la campaña." },
      { status: 409 },
    );
  }

  try {
    const result = await CampaignLogEntry.deleteMany({
      campaign: ctx.campaign._id,
      author: userId,
    });
    return NextResponse.json({ deleted: result.deletedCount });
  } catch (err) {
    console.error("Error al borrar las notas:", err);
    return NextResponse.json(
      { error: "No se pudieron borrar las notas. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
