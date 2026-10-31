import { NextRequest, NextResponse } from "next/server";
import { requireDm } from "@/lib/server/campaigns/campaignApi";
import { unbanMember } from "@/lib/server/campaigns/memberActions";
import { failureResponse } from "@/lib/server/result";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  const ctx = await requireDm(req, id);
  if (ctx.error) return ctx.error;

  const result = await unbanMember(ctx, userId);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
