import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { User } from "@/lib/User";
import { Notification } from "@/lib/Notification";

export async function POST(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  await connectDB();
  // La comprobación del rol se hace en la base de datos, no en el token. A quien no es admin le da 404.
  const me = await User.findById(session.id).select("role").lean();
  if (me?.role !== "admin")
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  const limited = await rateLimit("announce", session.id, 5, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  const text = (typeof body.text === "string" ? body.text : "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim();
  if (text.length < 3 || text.length > 500) {
    return NextResponse.json(
      { error: "El aviso debe tener entre 3 y 500 caracteres." },
      { status: 400 },
    );
  }

  try {
    // Una notificación por usuario verificado, en lotes de 500
    const now = new Date();
    let batch: object[] = [];
    let sent = 0;
    for await (const u of User.find({ verified: true })
      .select("_id")
      .lean()
      .cursor()) {
      batch.push({ user: u._id, type: "system", text, createdAt: now });
      if (batch.length >= 500) {
        await Notification.insertMany(batch, { ordered: false });
        sent += batch.length;
        batch = [];
      }
    }
    if (batch.length) {
      await Notification.insertMany(batch, { ordered: false });
      sent += batch.length;
    }
    return NextResponse.json({ sent });
  } catch (err) {
    console.error("Error al enviar el aviso masivo:", err);
    return NextResponse.json(
      { error: "No se pudo enviar el aviso. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
