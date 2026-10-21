import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { Campaign } from "@/lib/Campaign";
import { requireDm } from "@/lib/campaignApi";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  const ctx = await requireDm(req, id);
  if (ctx.error) return ctx.error;
  if (!mongoose.isValidObjectId(userId)) {
    return NextResponse.json(
      { error: "Usuario no encontrado." },
      { status: 404 },
    );
  }

  try {
    await Campaign.updateOne(
      { _id: ctx.campaign._id },
      { $pull: { banned: userId } },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al desbloquear de la campaña:", err);
    return NextResponse.json(
      { error: "No se pudo desbloquear. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
