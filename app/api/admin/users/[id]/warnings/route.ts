import { NextRequest, NextResponse } from "next/server";
import { readReason, requireAdminApi } from "@/lib/server/admin/adminApi";
import { warnUser } from "@/lib/server/admin/moderation";
import { failureResponse } from "@/lib/server/result";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";

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

  const result = await warnUser(ctx.session.id, id, input.reason);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
