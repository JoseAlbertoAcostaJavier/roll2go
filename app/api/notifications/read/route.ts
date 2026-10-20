import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { sessionOf } from "@/lib/campaignApi";
import { Notification } from "@/lib/Notification";

// POST { id } marca una como leída; POST { all: true } marca todas
export async function POST(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  let body: { id?: unknown; all?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  try {
    await connectDB();
    if (body.all === true) {
      await Notification.updateMany(
        { user: session.id, read: false },
        { $set: { read: true } },
      );
    } else if (
      typeof body.id === "string" &&
      mongoose.isValidObjectId(body.id)
    ) {
      await Notification.updateOne(
        { _id: body.id, user: session.id },
        { $set: { read: true } },
      );
    } else {
      return NextResponse.json(
        { error: "Petición no válida." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al marcar como leída:", err);
    return NextResponse.json(
      { error: "No se pudo completar la acción." },
      { status: 500 },
    );
  }
}
