import "server-only";
import { connectDB } from "@/lib/models/mongodb";
import { Campaign } from "@/lib/models/Campaign";
import { Block } from "@/lib/models/Block";
import { CampaignInvite } from "@/lib/models/CampaignInvite";
import { Notification } from "@/lib/models/Notification";
import { User } from "@/lib/models/User";
import { isValidId } from "@/lib/server/ids";
import { INVITE_REGEX, MAX_MEMBERS } from "@/lib/server/campaigns/members";
import { notify } from "@/lib/server/notifications/notify";
import { fail, type Result } from "@/lib/server/result";

export type JoinResult = "ok" | "already" | "banned" | "full" | "missing";

export async function joinCampaign(
  campaignId: unknown,
  userId: string,
): Promise<JoinResult> {
  const current = await Campaign.findById(campaignId)
    .select("members banned")
    .lean();
  if (!current) return "missing";
  if (current.members.some((m: unknown) => String(m) === userId))
    return "already";
  if ((current.banned ?? []).some((b: unknown) => String(b) === userId))
    return "banned";

  // Atómico: solo añade si todavía hay hueco (el elemento nº MAX_MEMBERS no existe) y no está bloqueado
  const updated = await Campaign.findOneAndUpdate(
    {
      _id: campaignId,
      banned: { $ne: userId },
      [`members.${MAX_MEMBERS - 1}`]: { $exists: false },
    },
    { $addToSet: { members: userId } },
  ).select("owner");
  if (!updated) return "full";

  // Aviso al DM (y correo, si lo tiene activado). Si falla, la persona ya ha entrado igualmente.
  try {
    await notify({
      user: String(updated.owner),
      type: "campaign_joined",
      actor: userId,
      campaign: String(campaignId),
    });
  } catch (err) {
    console.error("No se pudo avisar al DM:", err);
  }
  return "ok";
}

// Unirse con el código de un enlace de invitación. `already`: ya eras miembro.
export async function joinByInviteCode(
  userId: string,
  code: string,
): Promise<Result<{ id: string; already: boolean }>> {
  const invalid = () => fail(404, "El enlace no es válido o ha caducado.");
  if (!INVITE_REGEX.test(code)) return invalid();

  try {
    await connectDB();
    const campaign = await Campaign.findOne({
      inviteCode: code,
      $or: [
        { inviteExpires: { $exists: false } },
        { inviteExpires: { $gt: new Date() } },
      ],
    }).select("owner");
    if (!campaign) return invalid();

    // Quien ha sido bloqueado por el DM recibe el mismo mensaje que con un enlace caducado
    if (await Block.exists({ blocker: campaign.owner, blocked: userId }))
      return invalid();

    const result = await joinCampaign(campaign._id, userId);
    if (result === "banned" || result === "missing") return invalid();
    if (result === "full")
      return fail(409, "La campaña ha alcanzado el máximo de participantes.");
    return { ok: true, id: String(campaign._id), already: result === "already" };
  } catch (err) {
    console.error("Error al unirse a la campaña:", err);
    return fail(500, "No se pudo completar la unión. Inténtalo de nuevo.");
  }
}

/* Página de un enlace de invitación: la campaña que ofrece (con el nombre del DM), { member: true } si ya eres miembro o
   null si el enlace no existe, ha caducado o el DM lo ha desactivado. */
export async function loadInviteLanding(code: string, userId: string) {
  if (!INVITE_REGEX.test(code)) return null;
  await connectDB();
  const campaign = await Campaign.findOne({
    inviteCode: code,
    $or: [{ inviteExpires: { $exists: false } }, { inviteExpires: { $gt: new Date() } }],
  })
    .select("name systemId shortDescription owner members imageId")
    .lean();
  if (!campaign) return null;
  if (campaign.members.some((m: unknown) => String(m) === userId)) return { member: true as const, id: String(campaign._id) };

  const owner = await User.findById(campaign.owner).select("username").lean();
  return {
    member: false as const,
    id: String(campaign._id),
    name: campaign.name as string,
    systemId: campaign.systemId as string,
    shortDescription: (campaign.shortDescription ?? "") as string,
    imageId: campaign.imageId ? String(campaign.imageId) : null,
    memberCount: (campaign.members?.length ?? 1) as number,
    ownerName: (owner?.username ?? null) as string | null,
  };
}

/* Aceptar o rechazar una invitación dirigida a ti. Al rechazarla, o al aceptarla y entrar (o no poder entrar porque
   la campaña ya no existe o te han expulsado), desaparecen la invitación y su aviso. Devuelve la campaña al entrar. */
export async function answerInvite(
  userId: string,
  inviteId: string,
  action: "accept" | "decline",
): Promise<Result<{ campaignId?: string }>> {
  const gone = () => fail(404, "La invitación ya no existe.");
  if (!isValidId(inviteId)) return gone();

  try {
    await connectDB();
    const invite = await CampaignInvite.findOne({ _id: inviteId, user: userId });
    if (!invite) return gone();

    const clean = async () => {
      await invite.deleteOne();
      await Notification.deleteMany({ user: userId, type: "campaign_invite", campaign: invite.campaign });
    };

    if (action === "decline") {
      await clean();
      return { ok: true };
    }

    const result = await joinCampaign(invite.campaign, userId);
    if (result === "full") return fail(409, "La campaña ha alcanzado el máximo de participantes.");
    await clean();
    if (result === "banned" || result === "missing") return gone();
    return { ok: true, campaignId: String(invite.campaign) };
  } catch (err) {
    console.error("Error al responder a la invitación:", err);
    return fail(500, "No se pudo completar la acción. Inténtalo de nuevo.");
  }
}
