import { NextRequest, NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { requireDm } from "@/lib/server/campaigns/campaignApi";
import { clearInviteLink, setInviteLink } from "@/lib/server/campaigns/invites";
import { failureResponse } from "@/lib/server/result";

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

  const result = await setInviteLink(ctx, expiresIn);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ code: result.code, expiresAt: result.expiresAt });
}

// DESACTIVAR el enlace
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ctx = await requireDm(req, id);
  if (ctx.error) return ctx.error;

  const result = await clearInviteLink(ctx);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
