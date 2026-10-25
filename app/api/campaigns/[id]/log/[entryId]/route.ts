import { NextRequest, NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { requireMember } from "@/lib/server/campaigns/campaignApi";
import { parseLogBody } from "@/lib/server/campaigns/logInput";
import { deleteLogEntry, updateLogEntry } from "@/lib/server/campaigns/logEntries";
import { failureResponse } from "@/lib/server/result";

type Ctx = { params: Promise<{ id: string; entryId: string }> };

// EDITAR: solo el autor
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id, entryId } = await params;
  const ctx = await requireMember(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("log_edit", ctx.session.id, 60, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { title?: unknown; content?: unknown; visibility?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  const { errors, value } = parseLogBody(body);
  if (Object.keys(errors).length > 0)
    return NextResponse.json({ errors }, { status: 400 });

  const result = await updateLogEntry(ctx, entryId, value);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ id: entryId });
}

// BORRAR: el autor o el DM (moderación)
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id, entryId } = await params;
  const ctx = await requireMember(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("log_delete", ctx.session.id, 60, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const result = await deleteLogEntry(ctx, entryId);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
