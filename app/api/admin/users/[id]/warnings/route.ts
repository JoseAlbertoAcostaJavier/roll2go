import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { readReason, requireAdminApi } from "@/lib/adminApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { notify } from "@/lib/notify";
import { User } from "@/lib/User";

type Ctx = { params: Promise<{ id: string }> };

// POST: advertir a un usuario. Se guarda en su historial y se le avisa con una notificación.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ctx = await requireAdminApi(req);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("admin_warn", ctx.session.id, 60, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const input = await readReason(req);
  if ("error" in input) return input.error;

  if (!mongoose.isValidObjectId(id))
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  if (id === ctx.session.id)
    return NextResponse.json({ error: "No puedes advertirte a ti mismo." }, { status: 400 });

  try {
    const res = await User.updateOne(
      { _id: id },
      { $push: { warnings: { reason: input.reason, by: ctx.session.id, createdAt: new Date() } } },
    );
    if (res.matchedCount === 0)
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });

    await notify({
      user: id,
      type: "system",
      text: `Has recibido una advertencia de la moderación de Roll2Go. Motivo: ${input.reason}`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al advertir al usuario:", err);
    return NextResponse.json(
      { error: "No se pudo guardar la advertencia. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
