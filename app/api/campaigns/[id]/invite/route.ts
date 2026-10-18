import { NextRequest, NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Campaign } from "@/lib/Campaign";
import { requireDm } from "@/lib/campaignApi";
import { INVITE_EXPIRY_DAYS, newInviteCode } from "@/lib/members";

type Ctx = { params: Promise<{ id: string }> };

// CREAR o REGENERAR el enlace (el anterior deja de valer). Solo el DM.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ctx = await requireDm(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("invite", ctx.session.id, 20, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let expiresIn = "never";
  try {
    const body = await req.json();
    if (typeof body.expiresIn === "string") expiresIn = body.expiresIn;
  } catch {
    // sin cuerpo: el enlace no caduca
  }
  const days = INVITE_EXPIRY_DAYS[expiresIn];
  if (expiresIn !== "never" && !days) {
    return NextResponse.json(
      { error: "Caducidad no válida." },
      { status: 400 },
    );
  }

  const code = newInviteCode();
  const expires = days
    ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    : null;

  try {
    await Campaign.updateOne(
      { _id: ctx.campaign._id },
      // Sin caducidad no se guarda null: se borra el campo (ver lib/Campaign.ts)
      expires
        ? { $set: { inviteCode: code, inviteExpires: expires } }
        : { $set: { inviteCode: code }, $unset: { inviteExpires: "" } },
    );
    return NextResponse.json({
      code,
      expiresAt: expires ? expires.toISOString() : null,
    });
  } catch (err) {
    console.error("Error al crear el enlace de invitación:", err);
    return NextResponse.json(
      { error: "No se pudo crear el enlace. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}

// DESACTIVAR el enlace
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ctx = await requireDm(req, id);
  if (ctx.error) return ctx.error;

  try {
    await Campaign.updateOne(
      { _id: ctx.campaign._id },
      { $unset: { inviteCode: "", inviteExpires: "" } },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al desactivar el enlace de invitación:", err);
    return NextResponse.json(
      { error: "No se pudo desactivar el enlace." },
      { status: 500 },
    );
  }
}
