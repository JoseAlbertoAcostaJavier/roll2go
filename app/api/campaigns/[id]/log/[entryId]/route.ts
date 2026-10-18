import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { CampaignLogEntry } from "@/lib/CampaignLogEntry";
import { requireMember } from "@/lib/campaignApi";
import { parseLogBody } from "@/lib/logInput";

type Ctx = { params: Promise<{ id: string; entryId: string }> };

const notFound = () =>
  NextResponse.json({ error: "Nota no encontrada." }, { status: 404 });

// Una nota privada ajena solo la ven su autor y el DM: para el resto, es como si no existiera
async function loadVisible(
  campaignId: unknown,
  entryId: string,
  userId: string,
  isDm: boolean,
) {
  if (!mongoose.isValidObjectId(entryId)) return null;
  const entry = await CampaignLogEntry.findOne({
    _id: entryId,
    campaign: campaignId,
  });
  if (!entry) return null;
  const visible =
    entry.visibility === "public" || String(entry.author) === userId || isDm;
  return visible ? entry : null;
}

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

  try {
    const entry = await loadVisible(
      ctx.campaign._id,
      entryId,
      ctx.session.id,
      ctx.isDm,
    );
    if (!entry) return notFound();
    if (String(entry.author) !== ctx.session.id) {
      return NextResponse.json(
        { error: "Solo el autor puede editar la nota." },
        { status: 403 },
      );
    }
    entry.set(value);
    await entry.save(); // actualiza updatedAt
    return NextResponse.json({ id: entryId });
  } catch (err) {
    console.error("Error al editar la nota:", err);
    return NextResponse.json(
      { error: "No se pudo guardar la nota. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}

// BORRAR: el autor o el DM (moderación)
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id, entryId } = await params;
  const ctx = await requireMember(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit("log_delete", ctx.session.id, 60, 60 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  try {
    const entry = await loadVisible(
      ctx.campaign._id,
      entryId,
      ctx.session.id,
      ctx.isDm,
    );
    if (!entry) return notFound();
    if (String(entry.author) !== ctx.session.id && !ctx.isDm) {
      return NextResponse.json(
        { error: "No puedes borrar esta nota." },
        { status: 403 },
      );
    }
    await entry.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error al borrar la nota:", err);
    return NextResponse.json(
      { error: "No se pudo borrar la nota. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
