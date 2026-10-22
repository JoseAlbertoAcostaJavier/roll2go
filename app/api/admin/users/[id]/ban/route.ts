import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { readReason, requireAdminApi } from "@/lib/adminApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { forgetBan } from "@/lib/ban";
import { notify } from "@/lib/notify";
import { BannedEmail } from "@/lib/BannedEmail";
import { User } from "@/lib/User";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });

// POST: banear para siempre. Cierra sus sesiones, impide entrar y reservar otra vez su correo.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ctx = await requireAdminApi(req);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("admin_ban", ctx.session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const input = await readReason(req);
  if ("error" in input) return input.error;

  if (!mongoose.isValidObjectId(id)) return notFound();
  if (id === ctx.session.id)
    return NextResponse.json({ error: "No puedes banearte a ti mismo." }, { status: 400 });

  try {
    const target = await User.findById(id).select("email role bannedAt").lean();
    if (!target) return notFound();
    if (target.role === "admin")
      return NextResponse.json({ error: "No puedes banear a otro administrador." }, { status: 403 });
    if (target.bannedAt)
      return NextResponse.json({ error: "Este usuario ya está baneado." }, { status: 409 });

    // Las condiciones se repiten en la consulta por si el rol cambió entre medias
    const res = await User.updateOne(
      { _id: id, role: { $ne: "admin" }, bannedAt: null },
      { $set: { bannedAt: new Date(), banReason: input.reason, bannedBy: ctx.session.id } },
    );
    if (res.modifiedCount === 0)
      return NextResponse.json({ error: "No se pudo banear a este usuario." }, { status: 409 });

    await BannedEmail.updateOne(
      { email: target.email },
      { $set: { user: target._id } },
      { upsert: true },
    );
    forgetBan(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al banear al usuario:", err);
    return NextResponse.json(
      { error: "No se pudo banear al usuario. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}

// DELETE: quitar el baneo. Vuelve a poder iniciar sesión y su correo queda libre.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ctx = await requireAdminApi(req);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("admin_ban", ctx.session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  if (!mongoose.isValidObjectId(id)) return notFound();

  try {
    const target = await User.findById(id).select("email bannedAt").lean();
    if (!target) return notFound();
    if (!target.bannedAt)
      return NextResponse.json({ error: "Este usuario no está baneado." }, { status: 409 });

    await User.updateOne(
      { _id: id },
      { $set: { bannedAt: null, banReason: "" }, $unset: { bannedBy: 1 } },
    );
    await BannedEmail.deleteMany({ $or: [{ user: target._id }, { email: target.email }] });
    forgetBan(id);
    await notify({
      user: id,
      type: "system",
      text: "La moderación de Roll2Go ha levantado la suspensión de tu cuenta.",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al quitar el baneo:", err);
    return NextResponse.json(
      { error: "No se pudo quitar el baneo. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
