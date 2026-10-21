import { NextRequest, NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { Campaign } from "@/lib/Campaign";
import { CampaignInvite } from "@/lib/CampaignInvite";
import { requireDm } from "@/lib/campaignApi";
import { blockStatus } from "@/lib/blocks";
import { findUserByUsername, relationBetween } from "@/lib/friends";
import { MAX_MEMBERS } from "@/lib/members";
import { notify } from "@/lib/notify";

const MAX_PENDING = 30; // invitaciones sin responder por campaña

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requireDm(req, id);
  if (ctx.error) return ctx.error;

  const limited = await rateLimit(
    "campaign_invite",
    ctx.session.id,
    30,
    60 * 60,
  );
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { username?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const fail = (error: string, status: number) =>
    NextResponse.json({ error }, { status });
  try {
    const target = await findUserByUsername(
      typeof body.username === "string" ? body.username : "",
    );
    if (!target) return fail("No existe ningún usuario con ese nombre.", 404);
    const targetId = String(target._id);
    if (targetId === ctx.session.id)
      return fail("No puedes invitarte a ti mismo.", 400);

    // Solo se invita a amigos (para invitar a alguien que no lo es, está el enlace)
    if ((await relationBetween(ctx.session.id, targetId)) !== "friend") {
      return fail(
        "Solo puedes invitar a tus amigos. Envíale antes una solicitud desde Social.",
        403,
      );
    }
    if ((await blockStatus(ctx.session.id, targetId)).any)
      return fail("No puedes invitar a este usuario.", 403);

    const campaign = await Campaign.findById(ctx.campaign._id)
      .select("members banned")
      .lean();
    if (!campaign) return fail("Campaña no encontrada.", 404);
    if (campaign.members.some((m: unknown) => String(m) === targetId))
      return fail("Ya participa en la campaña.", 409);
    if ((campaign.banned ?? []).some((b: unknown) => String(b) === targetId)) {
      return fail(
        "Está en la lista de bloqueados de la campaña. Desbloquéalo antes de invitarle.",
        409,
      );
    }
    if (campaign.members.length >= MAX_MEMBERS)
      return fail("La campaña ha alcanzado el máximo de participantes.", 409);
    if (
      (await CampaignInvite.countDocuments({ campaign: campaign._id })) >=
      MAX_PENDING
    ) {
      return fail(
        "Tienes demasiadas invitaciones pendientes. Espera a que respondan o cancela alguna.",
        409,
      );
    }

    await CampaignInvite.create({
      campaign: campaign._id,
      user: targetId,
      invitedBy: ctx.session.id,
    });
    await notify({
      user: targetId,
      type: "campaign_invite",
      actor: ctx.session.id,
      campaign: id,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if ((err as { code?: number }).code === 11000)
      return fail("Ya has invitado a este usuario.", 409);
    console.error("Error al invitar:", err);
    return fail("No se pudo enviar la invitación. Inténtalo de nuevo.", 500);
  }
}
