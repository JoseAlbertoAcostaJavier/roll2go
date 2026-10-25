import { NextRequest, NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";
import { requireMember } from "@/lib/server/campaigns/campaignApi";
import { parseLogBody } from "@/lib/server/campaigns/logInput";
import { createLogEntry } from "@/lib/server/campaigns/logEntries";
import { failureResponse } from "@/lib/server/result";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requireMember(req, id); // cualquier miembro puede escribir notas
  if (ctx.error) return ctx.error;

  // Máximo 30 notas por hora y por usuario
  const limited = await rateLimit("log_create", ctx.session.id, 30, 60 * 60);
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

  const result = await createLogEntry(ctx, id, value);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ id: result.id }, { status: 201 });
}
