import "server-only";
// Invitaciones a una campaña: el enlace (crear, regenerar o desactivar) y las invitaciones a amigos. Solo el DM;
// `ctx` viene de requireDm.
import { Campaign } from "@/lib/models/Campaign";
import { CampaignInvite } from "@/lib/models/CampaignInvite";
import type { MemberContext } from "@/lib/server/campaigns/campaignApi";
import { INVITE_EXPIRY_DAYS, MAX_MEMBERS, newInviteCode } from "@/lib/server/campaigns/members";
import { blockStatus } from "@/lib/server/social/blocks";
import { findUserByUsername, relationBetween } from "@/lib/server/social/friends";
import { notify } from "@/lib/server/notifications/notify";
import { fail, type Result } from "@/lib/server/result";

const MAX_PENDING = 30; // invitaciones sin responder por campaña

// Crea o regenera el enlace (el anterior deja de valer). expiresIn: "never" o una clave de INVITE_EXPIRY_DAYS.
export async function setInviteLink(
  ctx: MemberContext,
  expiresIn: string,
): Promise<Result<{ code: string; expiresAt: string | null }>> {
  const days = INVITE_EXPIRY_DAYS[expiresIn];
  if (expiresIn !== "never" && !days) return fail(400, "Caducidad no válida.");

  const code = newInviteCode();
  const expires = days
    ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    : null;

  try {
    await Campaign.updateOne(
      { _id: ctx.campaign._id },
      // Sin caducidad no se guarda null: se borra el campo (ver lib/models/Campaign.ts)
      expires
        ? { $set: { inviteCode: code, inviteExpires: expires } }
        : { $set: { inviteCode: code }, $unset: { inviteExpires: "" } },
    );
    return { ok: true, code, expiresAt: expires ? expires.toISOString() : null };
  } catch (err) {
    console.error("Error al crear el enlace de invitación:", err);
    return fail(500, "No se pudo crear el enlace. Inténtalo de nuevo.");
  }
}

export async function clearInviteLink(ctx: MemberContext): Promise<Result> {
  try {
    await Campaign.updateOne(
      { _id: ctx.campaign._id },
      { $unset: { inviteCode: "", inviteExpires: "" } },
    );
    return { ok: true };
  } catch (err) {
    console.error("Error al desactivar el enlace de invitación:", err);
    return fail(500, "No se pudo desactivar el enlace.");
  }
}

// Invita a un amigo por su nombre de usuario (para invitar a alguien que no lo es, está el enlace)
export async function inviteFriend(ctx: MemberContext, campaignId: string, username: string): Promise<Result> {
  try {
    const target = await findUserByUsername(username);
    if (!target) return fail(404, "No existe ningún usuario con ese nombre.");
    const targetId = String(target._id);
    if (targetId === ctx.session.id)
      return fail(400, "No puedes invitarte a ti mismo.");

    if ((await relationBetween(ctx.session.id, targetId)) !== "friend") {
      return fail(
        403,
        "Solo puedes invitar a tus amigos. Envíale antes una solicitud desde Social.",
      );
    }
    if ((await blockStatus(ctx.session.id, targetId)).any)
      return fail(403, "No puedes invitar a este usuario.");

    const campaign = await Campaign.findById(ctx.campaign._id)
      .select("members banned")
      .lean();
    if (!campaign) return fail(404, "Campaña no encontrada.");
    if (campaign.members.some((m: unknown) => String(m) === targetId))
      return fail(409, "Ya participa en la campaña.");
    if ((campaign.banned ?? []).some((b: unknown) => String(b) === targetId)) {
      return fail(
        409,
        "Está en la lista de bloqueados de la campaña. Desbloquéalo antes de invitarle.",
      );
    }
    if (campaign.members.length >= MAX_MEMBERS)
      return fail(409, "La campaña ha alcanzado el máximo de participantes.");
    if (
      (await CampaignInvite.countDocuments({ campaign: campaign._id })) >=
      MAX_PENDING
    ) {
      return fail(
        409,
        "Tienes demasiadas invitaciones pendientes. Espera a que respondan o cancela alguna.",
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
      campaign: campaignId,
    });
    return { ok: true };
  } catch (err) {
    if ((err as { code?: number }).code === 11000)
      return fail(409, "Ya has invitado a este usuario.");
    console.error("Error al invitar:", err);
    return fail(500, "No se pudo enviar la invitación. Inténtalo de nuevo.");
  }
}
