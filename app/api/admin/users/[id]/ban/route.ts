import { NextRequest, NextResponse } from "next/server";
import { readReason, requireAdminApi } from "@/lib/server/admin/adminApi";
import { banUser, unbanUser } from "@/lib/server/admin/moderation";
import { failureResponse } from "@/lib/server/result";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";

type Ctx = { params: Promise<{ id: string }> };

// POST: banear para siempre. Cierra sus sesiones, impide entrar y reservar otra vez su correo.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ctx = await requireAdminApi(req);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("admin_ban", ctx.session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const input = await readReason(req);
  if ("error" in input) return input.error;

  const result = await banUser(ctx.session.id, id, input.reason);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}

// DELETE: quitar el baneo. Vuelve a poder iniciar sesión y su correo queda libre.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ctx = await requireAdminApi(req);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("admin_ban", ctx.session.id, 30, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const result = await unbanUser(id);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
